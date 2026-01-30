import { StatsRepository, StatsStreakFields } from "../repositories/StatsRepository.js";
import { Stats, StatsScope } from "../models/Stats.js";
import { TODO_STATUS } from "../constants/todo.constants.js";
import { addDays, todayISO } from "../utils/util.js";
import { TodoRepository } from "../repositories/TodoRepository.js";
import { logger } from "../utils/logger.js";
import { HabitService } from "./HabitService.js";
import { isValidForTargetDate } from "./TodoService.js";

interface UpdateStatsOnStatusChangeParams {
    userId: string;
    habitId: string;
    categoryId: string;
    date: string;
    newStatus: string;
    previousStatus?: string;
}

interface UpdateStatsIncrementalParams {
    userId: string;
    habitId: string;
    date: string;
    newStatus: string;
    previousStatus?: string;
}

interface RecalculateHabitStatsFromDateParams {
    userId: string;
    habitId: string;
    date: string;
    newStatus: string;
    previousStatus?: string;
}

export class StatsService {
    private repository = new StatsRepository();
    private todoRepository = new TodoRepository();
    private habitService = new HabitService();

    async createStats(userId: string, habitId: string, categoryId: string): Promise<Stats[]> {
        const now = new Date().toISOString();
        const scopes: StatsScope[] = ["HABIT", "CATEGORY", "USER"];

        const statsPromises = scopes.map(async (scope) => {
            const stats: Stats = {
                PK: this.generatePK(userId),
                SK: this.generateSK(scope, habitId, categoryId),
                habitId,
                userId,
                categoryId,
                scope,
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
                createdAt: now,
                updatedAt: now,
            };

            await this.repository.create(stats);
            return stats;
        });

        return await Promise.all(statsPromises);
    }

    async updateStatsOnTodoStatusChange({
        userId,
        habitId,
        categoryId,
        date,
        newStatus,
        previousStatus,
    }: UpdateStatsOnStatusChangeParams): Promise<void> {
        if (newStatus === previousStatus) {
            return;
        }

        if (date === todayISO()) {
            await this.updateHabitStatsIncremental({ userId, habitId, date, newStatus, previousStatus });
        } else {
            await this.recalculateHabitStats(userId, habitId);
        }
    }

    async updateHabitStatsIncremental({
        userId,
        habitId,
        date,
        newStatus,
        previousStatus,
    }: UpdateStatsIncrementalParams): Promise<void> {
        const habitStats = await this.repository.get(this.generatePK(userId), this.generateSK("HABIT", habitId, ""));

        let currentStreak = habitStats?.currentStreak ?? 0;
        let lastCompletedDate = habitStats?.lastCompletedDate;
        let totalCompletions = habitStats?.totalCompletions ?? 0;

        if (newStatus === TODO_STATUS.DONE) {
            totalCompletions += 1;
            const yesterday = addDays(date, -1);
            if (lastCompletedDate === yesterday) {
                currentStreak++;
                lastCompletedDate = date;
            } else {
                currentStreak = 1;
                lastCompletedDate = date;
            }
        } else if (previousStatus === TODO_STATUS.DONE) {
            totalCompletions = Math.max(0, totalCompletions - 1);
            if (lastCompletedDate === date) {
                const yesterday = addDays(date, -1);
                const todoYesterday = await this.todoRepository.findByUserDateAndHabit(userId, yesterday, habitId);
                if (todoYesterday?.status === TODO_STATUS.DONE) {
                    currentStreak = Math.max(0, currentStreak - 1);
                    lastCompletedDate = yesterday;
                } else {
                    currentStreak = 0;
                    lastCompletedDate = undefined;
                }
            }
        }

        const longestStreak = Math.max(habitStats?.longestStreak ?? 0, currentStreak);

        await this.repository.updateStreakFields(this.generatePK(userId), this.generateSK("HABIT", habitId, ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions,
        });
    }

    async recalculateHabitStats(userId: string, habitId: string): Promise<void> {
        logger.info(`Recalculating stats for habit ${habitId} for user ${userId}`);

        const habit = await this.habitService.getHabitById(userId, habitId);

        let endDate = habit.end_date;
        if (!endDate) {
            endDate = todayISO();
        }
        const queryEndDate = todayISO() >= endDate ? todayISO() : endDate;

        const todoList = await this.todoRepository.findAllByDateRange(userId, habit.start_date, queryEndDate);

        const completedDates = todoList.reduce<Set<string>>((set, t) => {
            if (t.habitId === habitId && t.status === TODO_STATUS.DONE) {
                set.add(t.date);
            }
            return set;
        }, new Set());

        const scheduledDates = await this.habitService.getScheduledDates(habit, queryEndDate);

        const sortedAsc = [...scheduledDates].sort();

        let currentStreak = 0;
        let longestStreak = 0;
        let run = 0;
        let lastCompletedDate: string | undefined;
        let lastStreakStartDate: string | undefined;
        let runStartDate: string | undefined;
        let lastRunLengthWhenGap = 0;
        let lastRunStartWhenGap: string | undefined;

        for (const date of sortedAsc) {
            if (completedDates.has(date)) {
                run++;
                if (run === 1) runStartDate = date;
                longestStreak = Math.max(longestStreak, run);
                lastCompletedDate = date;
            } else {
                if (run > 0) {
                    lastRunLengthWhenGap = run;
                    lastRunStartWhenGap = runStartDate;
                }
                run = 0;
                runStartDate = undefined;
            }
        }

        if (run > 0) {
            currentStreak = run;
            lastStreakStartDate = runStartDate;
        } else {
            currentStreak = lastRunLengthWhenGap;
            lastStreakStartDate = lastRunStartWhenGap;
        }

        await this.repository.updateStreakFields(this.generatePK(userId), this.generateSK("HABIT", habitId, ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            lastStreakStartDate,
            totalCompletions: completedDates.size,
        });
        logger.info(`Stats updated for habit ${habitId} for user ${userId}`, {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            lastStreakStartDate,
            totalCompletions: completedDates.size,
        });
    }

    async getHabitStreak(userId: string, habitId: string): Promise<number> {
        const stats = await this.repository.get(this.generatePK(userId), this.generateSK("HABIT", habitId, ""));
        return stats?.currentStreak ?? 0;
    }

    private generatePK(userId: string): string {
        return `USER#${userId}`;
    }

    private generateSK(scope: StatsScope, habitId: string, categoryId: string): string {
        switch (scope) {
            case "HABIT":
                return `STATS#HABIT#${habitId}`;
            case "CATEGORY":
                return `STATS#CATEGORY#${categoryId}`;
            case "USER":
                return `STATS#USER`;
            default:
                throw new Error(`Invalid scope: ${scope}`);
        }
    }
}
