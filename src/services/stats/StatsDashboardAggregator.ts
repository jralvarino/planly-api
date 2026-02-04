import { StatsRepository } from "../../repositories/StatsRepository.js";
import { TodoRepository } from "../../repositories/TodoRepository.js";
import { HabitService } from "../HabitService.js";
import { generatePK, generateSK } from "./StatsKeyGenerator.js";
import { logger } from "../../utils/logger.js";
import type { TodoList } from "../../models/TodoList.js";
import { datesRange } from "../../utils/util.js";
import { TODO_STATUS } from "../../constants/todo.constants.js";

/**
 * Simplified habit data for selected date display
 */
export interface HabitForSelectedDate {
    id: string;
    title: string;
    emoji: string;
    categoryId: string;
    completedAt?: string;
    status: string;
}

/**
 * Calculates the best (longest) consecutive streak from an array of completed dates.
 * @param completedDates Array of date strings in YYYY-MM-DD format (must be sorted)
 * @returns The length of the longest consecutive streak
 */
function calculateBestStreakFromDates(completedDates: string[]): number {
    if (completedDates.length === 0) return 0;

    let bestStreak = 1;
    let currentStreak = 1;

    for (let i = 1; i < completedDates.length; i++) {
        const prevDate = new Date(completedDates[i - 1]);
        const currDate = new Date(completedDates[i]);
        const diffDays = Math.floor((currDate.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
            currentStreak++;
            bestStreak = Math.max(bestStreak, currentStreak);
        } else {
            currentStreak = 1;
        }
    }

    return bestStreak;
}

export interface StatsDashboardData {
    completedDates: string[];
    globalStreak: number;
    globalLongestStreak: number;
    globalTotalCompletions: number;
    lastCompletedDate: string | null;
    monthCompletionCount: number;
    monthCompletionRate: number;
    monthTotalCompletions: number;
    monthDailyAverage: number;
    monthBestStreak: number;
    habitsForSelectedDate?: HabitForSelectedDate[];
    categoryStreak?: number;
    categoryLongestStreak?: number;
    categoryTotalCompletions?: number;
    categoryMonthTotalCompletions?: number;
    categoryMonthDailyAverage?: number;
    categoryMonthBestStreak?: number;
    habitStreak?: number;
    habitMonthTotalCompletions?: number;
    habitMonthDailyAverage?: number;
    habitMonthBestStreak?: number;
}

export interface StatsDashboardAggregatorDeps {
    repository: StatsRepository;
    todoRepository: TodoRepository;
    habitService: HabitService;
    getTodoListByDate: (userId: string, date: string, categoryId?: string, habitId?: string) => Promise<TodoList[]>;
}

export class StatsDashboardAggregator {
    constructor(private readonly deps: StatsDashboardAggregatorDeps) {}

    async getData(
        userId: string,
        month: string,
        categoryId?: string,
        habitId?: string,
        selectedDate?: string
    ): Promise<StatsDashboardData> {
        logger.info("Stats getDashboardData", { userId, month, categoryId, habitId, selectedDate });

        const [y, m] = month.split("-").map(Number);
        const firstDay = `${month}-01`;
        const lastDay = new Date(y, m, 0).toISOString().slice(0, 10);
        const daysInMonth = new Date(y, m, 0).getDate();

        // completedDates: dias em que TODOS os hábitos do dia estão DONE (usa lista completa do dia, não só TODOs na BD)
        const monthDates = datesRange(firstDay, lastDay);
        const completedDates: string[] = [];
        for (const date of monthDates) {
            const todoList = await this.deps.getTodoListByDate(userId, date, categoryId, habitId);
            const allDone = todoList.length > 0 && todoList.every((t) => t.status === TODO_STATUS.DONE);
            if (allDone) {
                completedDates.push(date);
            }
        }
        completedDates.sort();

        let habitsForSelectedDate: HabitForSelectedDate[] | undefined;
        if (selectedDate) {
            const todoList = await this.deps.getTodoListByDate(userId, selectedDate, categoryId, habitId);
            habitsForSelectedDate = todoList.map((todo) => ({
                id: todo.id,
                title: todo.title,
                emoji: todo.emoji,
                categoryId: todo.categoryId,
                completedAt: todo.completedAt,
                status: todo.status,
            }));
        }

        const userPk = generatePK(userId);
        const userSk = generateSK("USER", "", "");
        const userStats = await this.deps.repository.get(userPk, userSk);

        const globalStreak = userStats?.currentStreak ?? 0;
        const globalLongestStreak = userStats?.longestStreak ?? 0;
        const globalTotalCompletions = userStats?.totalCompletions ?? 0;
        const lastCompletedDate = userStats?.lastCompletedDate ?? null;

        const monthCompletionCount = completedDates.length;
        const monthCompletionRate = daysInMonth > 0 ? monthCompletionCount / daysInMonth : 0;

        // Fetch all TODOs from the month to calculate monthTotalCompletions
        const allMonthTodos = await this.deps.todoRepository.findAllByDateRange(userId, firstDay, lastDay);

        // Calculate monthTotalCompletions for USER (all completed todos in the month)
        const monthTotalCompletions = allMonthTodos.filter((t) => t.status === TODO_STATUS.DONE).length;
        const monthDailyAverage = daysInMonth > 0 ? monthTotalCompletions / daysInMonth : 0;
        const monthBestStreak = calculateBestStreakFromDates(completedDates);

        // Calculate for CATEGORY if filtered
        let categoryMonthTotalCompletions: number | undefined;
        let categoryMonthDailyAverage: number | undefined;
        let categoryMonthBestStreak: number | undefined;
        let categoryCompletedDates: string[] | undefined;

        if (categoryId) {
            // Get all habits for this category to filter todos
            const categoryHabits = await this.deps.habitService.getAllHabits(userId, categoryId);
            const categoryHabitIds = new Set(categoryHabits.map((h) => h.id));

            categoryMonthTotalCompletions = allMonthTodos.filter(
                (t) => categoryHabitIds.has(t.habitId) && t.status === TODO_STATUS.DONE
            ).length;
            categoryMonthDailyAverage = daysInMonth > 0 ? categoryMonthTotalCompletions / daysInMonth : 0;

            // Calculate category-specific completed dates for best streak
            categoryCompletedDates = [];
            for (const date of monthDates) {
                const todoList = await this.deps.getTodoListByDate(userId, date, categoryId, undefined);
                const allDone = todoList.length > 0 && todoList.every((t) => t.status === TODO_STATUS.DONE);
                if (allDone) {
                    categoryCompletedDates.push(date);
                }
            }
            categoryCompletedDates.sort();
            categoryMonthBestStreak = calculateBestStreakFromDates(categoryCompletedDates);
        }

        // Calculate for HABIT if filtered
        let habitMonthTotalCompletions: number | undefined;
        let habitMonthDailyAverage: number | undefined;
        let habitMonthBestStreak: number | undefined;
        let habitCompletedDates: string[] | undefined;

        if (habitId) {
            habitMonthTotalCompletions = allMonthTodos.filter(
                (t) => t.habitId === habitId && t.status === TODO_STATUS.DONE
            ).length;
            habitMonthDailyAverage = daysInMonth > 0 ? habitMonthTotalCompletions / daysInMonth : 0;

            // Calculate habit-specific completed dates for best streak
            habitCompletedDates = [];
            for (const date of monthDates) {
                const todoList = await this.deps.getTodoListByDate(userId, date, undefined, habitId);
                const allDone = todoList.length > 0 && todoList.every((t) => t.status === TODO_STATUS.DONE);
                if (allDone) {
                    habitCompletedDates.push(date);
                }
            }
            habitCompletedDates.sort();
            habitMonthBestStreak = calculateBestStreakFromDates(habitCompletedDates);
        }

        const result: StatsDashboardData = {
            completedDates,
            globalStreak,
            globalLongestStreak,
            globalTotalCompletions,
            lastCompletedDate,
            monthCompletionCount,
            monthCompletionRate,
            monthTotalCompletions,
            monthDailyAverage,
            monthBestStreak,
        };

        if (habitsForSelectedDate !== undefined) {
            result.habitsForSelectedDate = habitsForSelectedDate;
        }

        if (categoryId) {
            const categorySk = generateSK("CATEGORY", "", categoryId);
            const categoryStats = await this.deps.repository.get(userPk, categorySk);
            result.categoryStreak = categoryStats?.currentStreak ?? 0;
            result.categoryLongestStreak = categoryStats?.longestStreak ?? 0;
            result.categoryTotalCompletions = categoryStats?.totalCompletions ?? 0;
            result.categoryMonthTotalCompletions = categoryMonthTotalCompletions;
            result.categoryMonthDailyAverage = categoryMonthDailyAverage;
            result.categoryMonthBestStreak = categoryMonthBestStreak;
        }

        if (habitId) {
            const habitSk = generateSK("HABIT", habitId, "");
            const habitStats = await this.deps.repository.get(userPk, habitSk);
            result.habitStreak = habitStats?.currentStreak ?? 0;
            result.habitMonthTotalCompletions = habitMonthTotalCompletions;
            result.habitMonthDailyAverage = habitMonthDailyAverage;
            result.habitMonthBestStreak = habitMonthBestStreak;
        }

        return result;
    }
}
