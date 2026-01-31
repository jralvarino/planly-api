import { StatsRepository } from "../../repositories/StatsRepository.js";
import { TodoRepository } from "../../repositories/TodoRepository.js";
import { HabitService } from "../HabitService.js";
import { Habit } from "../../models/Habit.js";
import { TODO_STATUS } from "../../constants/todo.constants.js";
import { addDays, todayISO } from "../../utils/util.js";
import { logger } from "../../utils/logger.js";
import { computeFullStreakStats, computeStreakUpTo } from "./StreakCalculator.js";
import { getCompletedDatesFromTodoList } from "./completedDates.js";
import { generatePK, generateSK, getEndDate } from "./StatsKeyGenerator.js";
import type { Stats } from "../../models/Stats.js";

export interface GetHabitStatsFn {
    (params: { scope: "HABIT"; userId: string; habitId: string; categoryId?: string }): Promise<Stats>;
}

export interface HabitStatsUpdaterParams {
    repository: StatsRepository;
    todoRepository: TodoRepository;
    habitService: HabitService;
    getHabitStats: GetHabitStatsFn;
}

export interface UpdateHabitStatsIncrementalParams {
    userId: string;
    habitId: string;
    date: string;
    newStatus?: string;
    previousStatus?: string;
}

export class HabitStatsUpdater {
    constructor(private readonly params: HabitStatsUpdaterParams) {}

    async updateIncremental(params: UpdateHabitStatsIncrementalParams): Promise<void> {
        const { repository, todoRepository, habitService, getHabitStats } = this.params;
        const { userId, habitId, date, newStatus, previousStatus } = params;

        logger.info(
            `Updating habit stats incremental for user ${userId} and habit ${habitId} and date ${date}`
        );

        let { currentStreak, lastCompletedDate, totalCompletions, longestStreak } = await getHabitStats({
            scope: "HABIT",
            userId,
            habitId,
        });

        const habit = await habitService.getHabitById(userId, habitId);
        const sortedScheduled = [...(await habitService.getScheduledDates(habit, date))].sort();
        const previousScheduledDate = await this.getPreviousScheduledDate(habit, date);

        if (newStatus === TODO_STATUS.DONE) {
            totalCompletions += 1;
            if (previousScheduledDate != null && lastCompletedDate === previousScheduledDate) {
                currentStreak++;
                lastCompletedDate = date;
            } else {
                currentStreak = 1;
                lastCompletedDate = date;
            }
        } else if (previousStatus === TODO_STATUS.DONE) {
            totalCompletions = Math.max(0, totalCompletions - 1);
            if (lastCompletedDate === date) {
                if (previousScheduledDate == null) {
                    currentStreak = 0;
                    lastCompletedDate = undefined;
                } else {
                    const todoList = await todoRepository.findAllByDateRange(userId, habit.start_date, date);
                    const completedDates = getCompletedDatesFromTodoList(todoList, habitId);
                    const { streak, lastCompletedDate: lastInRange } = computeStreakUpTo(
                        sortedScheduled,
                        completedDates,
                        previousScheduledDate
                    );
                    currentStreak = streak;
                    lastCompletedDate = lastInRange;
                }
            }
        }

        longestStreak = Math.max(longestStreak ?? 0, currentStreak);

        logger.debug("Habit stats incremental computed", {
            userId,
            habitId,
            date,
            newStatus,
            previousStatus,
            previousScheduledDate,
            computed: {
                currentStreak,
                longestStreak,
                lastCompletedDate,
                totalCompletions,
            },
        });

        await repository.updateStreakFields(generatePK(userId), generateSK("HABIT", habitId, ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions,
        });
    }

    async recalculate(userId: string, habitId: string): Promise<void> {
        const { repository, todoRepository, habitService, getHabitStats } = this.params;

        logger.info("Recalculating stats for habit", { userId, habitId });

        const habit = await habitService.getHabitById(userId, habitId);
        const queryEndDate = getEndDate(habit);

        const todoList = await todoRepository.findAllByDateRange(userId, habit.start_date, queryEndDate);
        const completedDates = getCompletedDatesFromTodoList(todoList, habitId);

        const scheduledDates = await habitService.getScheduledDates(habit, queryEndDate);
        const sortedAsc = [...scheduledDates].sort();
        const today = todayISO();

        logger.debug("Habit recalculate inputs", {
            userId,
            habitId,
            start_date: habit.start_date,
            queryEndDate,
            scheduledDatesCount: sortedAsc.length,
            completedDatesCount: completedDates.size,
        });

        const { currentStreak, longestStreak, lastCompletedDate } = computeFullStreakStats(
            sortedAsc,
            completedDates,
            today
        );

        await repository.updateStreakFields(generatePK(userId), generateSK("HABIT", habitId, ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions: completedDates.size,
        });
        logger.info("Stats updated for habit", {
            userId,
            habitId,
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions: completedDates.size,
        });
    }

    private async getPreviousScheduledDate(habit: Habit, date: string): Promise<string | undefined> {
        const scheduledDates = await this.params.habitService.getScheduledDates(habit, date);
        const sorted = [...scheduledDates].sort();
        const before = sorted.filter((d) => d < date);
        return before[before.length - 1] ?? undefined;
    }
}
