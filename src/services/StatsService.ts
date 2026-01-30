import { StatsRepository, StatsStreakFields } from "../repositories/StatsRepository.js";
import { Stats, StatsScope } from "../models/Stats.js";
import { TODO_STATUS } from "../constants/todo.constants.js";
import { addDays, todayISO } from "../utils/util.js";
import { TodoRepository } from "../repositories/TodoRepository.js";
import { logger } from "../utils/logger.js";
import { InternalServerError } from "../errors/PlanlyError.js";
import { HabitService } from "./HabitService.js";
import { TodoService, isValidForTargetDate } from "./TodoService.js";
import { TodoList } from "../models/TodoList.js";

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
    newStatus?: string;
    previousStatus?: string;
    categoryId?: string;
}

interface GetHabitStatsParams {
    scope: StatsScope;
    userId: string;
    habitId: string;
    categoryId?: string;
}

export class StatsService {
    private repository = new StatsRepository();
    private todoRepository = new TodoRepository();
    private habitService = new HabitService();
    private _todoService: TodoService | null = null;

    private get todoService(): TodoService {
        if (!this._todoService) {
            this._todoService = new TodoService();
        }
        return this._todoService;
    }

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

    async updateStatsOnTodoStatusChange(params: UpdateStatsOnStatusChangeParams): Promise<void> {
        try {
            const { userId, habitId, categoryId, date, newStatus, previousStatus } = params;
            if (newStatus === previousStatus) {
                return;
            }

            if (date === todayISO()) {
                const scopes = ["HABIT", "CATEGORY", "USER"] as const;
                const results = await Promise.allSettled([
                    this.updateHabitStatsIncremental({ userId, habitId, date, newStatus, previousStatus }),
                    this.updateCategoryStatsIncremental({
                        userId,
                        habitId,
                        categoryId,
                        date,
                    }),
                    this.updateUserStatsIncremental({ userId, habitId, date }),
                ]);
                this.throwIfStatsUpdatesFailed(results, scopes, { userId, habitId, date });
            } else {
                await this.recalculateHabitStats(userId, habitId);
            }
        } catch (error) {
            if (error instanceof InternalServerError) {
                throw error;
            }
            logger.error(
                `Error updating stats on todo status change for user ${params.userId} and habit ${params.habitId}`,
                {
                    error,
                }
            );
            throw error;
        }
    }

    async getHabitStreak(userId: string, habitId: string): Promise<number> {
        const stats = await this.repository.get(this.generatePK(userId), this.generateSK("HABIT", habitId, ""));
        return stats?.currentStreak ?? 0;
    }

    async getGlobalStreak(userId: string): Promise<number> {
        const stats = await this.repository.get(this.generatePK(userId), this.generateSK("USER", "", ""));
        return stats?.currentStreak ?? 0;
    }

    async getHabitStats(params: GetHabitStatsParams): Promise<Stats> {
        const habitStats = await this.repository.get(
            this.generatePK(params.userId),
            this.generateSK(params.scope, params.habitId, params.categoryId || "")
        );
        return habitStats!;
    }

    private async updateHabitStatsIncremental(params: UpdateStatsIncrementalParams): Promise<void> {
        logger.info(
            `Updating habit stats incremental for user ${params.userId} and habit ${params.habitId} and date ${params.date}`
        );

        const { userId, habitId, date, newStatus, previousStatus } = params;

        let { currentStreak, lastCompletedDate, totalCompletions, longestStreak } = await this.getHabitStats({
            scope: "HABIT",
            userId,
            habitId,
        });

        const yesterday = addDays(date, -1);
        if (newStatus === TODO_STATUS.DONE) {
            totalCompletions += 1;
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

        longestStreak = Math.max(longestStreak ?? 0, currentStreak);

        await this.repository.updateStreakFields(this.generatePK(userId), this.generateSK("HABIT", habitId, ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions,
        });
    }

    private async updateCategoryStatsIncremental(params: UpdateStatsIncrementalParams): Promise<void> {
        logger.info(
            `Updating category stats incremental for user ${params.userId} and category ${params.categoryId} and date ${params.date}`
        );

        const { userId, habitId, categoryId, date } = params;

        const isAllTodayComplete = await this.isAllTodoByCategoryCompleted(userId, categoryId ?? "", date);

        let { currentStreak, lastCompletedDate, totalCompletions, longestStreak } = await this.getHabitStats({
            scope: "CATEGORY",
            userId,
            habitId,
            categoryId,
        });

        const yesterday = addDays(date, -1);

        if (isAllTodayComplete) {
            totalCompletions += 1;
            if (lastCompletedDate === yesterday) {
                currentStreak++;
                lastCompletedDate = date;
            } else {
                currentStreak = 1;
                lastCompletedDate = date;
            }
        } else if (lastCompletedDate === date) {
            totalCompletions = Math.max(0, totalCompletions - 1);
            const isAllYesterdayComplete = await this.isAllTodoByCategoryCompleted(userId, categoryId ?? "", yesterday);

            if (isAllYesterdayComplete) {
                currentStreak = Math.max(0, currentStreak - 1);
                lastCompletedDate = yesterday;
            } else {
                currentStreak = 0;
                lastCompletedDate = undefined;
            }
        } else {
            logger.info(
                `Category ${categoryId} is not completed yet for user ${userId} and date ${date} no change in stats`
            );
            return;
        }
        longestStreak = Math.max(longestStreak ?? 0, currentStreak);

        await this.repository.updateStreakFields(
            this.generatePK(userId),
            this.generateSK("CATEGORY", habitId, categoryId ?? ""),
            {
                currentStreak,
                longestStreak,
                lastCompletedDate,
                totalCompletions,
            }
        );
    }

    private async updateUserStatsIncremental({ userId, habitId, date }: UpdateStatsIncrementalParams): Promise<void> {
        logger.info(`Updating user stats incremental for user ${userId} and date ${date}`);
        const isAllTodayComplete = await this.isAllTodoByUserCompleted(userId, date);

        let { currentStreak, lastCompletedDate, totalCompletions, longestStreak } = await this.getHabitStats({
            scope: "USER",
            userId,
            habitId: "",
            categoryId: "",
        });

        const yesterday = addDays(date, -1);

        if (isAllTodayComplete) {
            totalCompletions += 1;
            if (lastCompletedDate === yesterday) {
                currentStreak++;
                lastCompletedDate = date;
            } else {
                currentStreak = 1;
                lastCompletedDate = date;
            }
        } else if (lastCompletedDate === date) {
            totalCompletions = Math.max(0, totalCompletions - 1);
            const isAllYesterdayComplete = await this.isAllTodoByUserCompleted(userId, yesterday);

            if (isAllYesterdayComplete) {
                currentStreak = Math.max(0, currentStreak - 1);
                lastCompletedDate = yesterday;
            } else {
                currentStreak = 0;
                lastCompletedDate = undefined;
            }
        } else {
            logger.info(`User ${userId} is not fully complete for date ${date} no change in stats`);
            return;
        }
        longestStreak = Math.max(longestStreak ?? 0, currentStreak);

        await this.repository.updateStreakFields(this.generatePK(userId), this.generateSK("USER", habitId, ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions,
        });
    }

    private async recalculateHabitStats(userId: string, habitId: string): Promise<void> {
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
        } else {
            currentStreak = lastRunLengthWhenGap;
        }

        await this.repository.updateStreakFields(this.generatePK(userId), this.generateSK("HABIT", habitId, ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions: completedDates.size,
        });
        logger.info(`Stats updated for habit ${habitId} for user ${userId}`, {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions: completedDates.size,
        });
    }

    private throwIfStatsUpdatesFailed(
        results: PromiseSettledResult<void>[],
        scopes: readonly string[],
        context: { userId: string; habitId: string; date: string }
    ): void {
        const failed: string[] = [];
        const errors: Array<{ scope: string; reason: unknown }> = [];

        results.forEach((result, index) => {
            const scope = scopes[index];
            if (result.status === "rejected") {
                failed.push(scope);
                errors.push({ scope, reason: result.reason });
                logger.error(`Stats update failed for scope ${scope}`, {
                    scope,
                    ...context,
                    error: result.reason,
                });
            }
        });

        if (failed.length > 0) {
            throw new InternalServerError("One or more stats updates failed", {
                failed,
                errors: errors.map((e) => ({
                    scope: e.scope,
                    message: e.reason instanceof Error ? e.reason.message : String(e.reason),
                })),
            });
        }
    }

    private async isAllTodoByCategoryCompleted(userId: string, categoryId: string, date: string): Promise<boolean> {
        const todoList = await this.todoService.getTodoListByDate(userId, date);
        const todoByCategory = todoList.filter((todo) => todo.categoryId === categoryId);
        return todoByCategory.length > 0 && todoByCategory.every((t) => t.status === TODO_STATUS.DONE);
    }

    private async isAllTodoByUserCompleted(userId: string, date: string): Promise<boolean> {
        const todoList = await this.todoService.getTodoListByDate(userId, date);
        return todoList.length > 0 && todoList.every((t) => t.status === TODO_STATUS.DONE);
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
