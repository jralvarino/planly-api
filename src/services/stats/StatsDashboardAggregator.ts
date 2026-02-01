import { StatsRepository } from "../../repositories/StatsRepository.js";
import { TodoRepository } from "../../repositories/TodoRepository.js";
import { HabitService } from "../HabitService.js";
import { generatePK, generateSK } from "./StatsKeyGenerator.js";
import { logger } from "../../utils/logger.js";
import type { TodoList } from "../../models/TodoList.js";
import { datesRange } from "../../utils/util.js";
import { TODO_STATUS } from "../../constants/todo.constants.js";

export interface StatsDashboardData {
    completedDates: string[];
    globalStreak: number;
    globalLongestStreak: number;
    globalTotalCompletions: number;
    lastCompletedDate: string | null;
    monthCompletionCount: number;
    monthCompletionRate: number;
    daysInMonth: number;
    habitsForSelectedDate?: TodoList[];
    categoryStreak?: number;
    categoryLongestStreak?: number;
    categoryTotalCompletions?: number;
    habitStreak?: number;
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
            const allDone =
                todoList.length > 0 && todoList.every((t) => t.status === TODO_STATUS.DONE);
            if (allDone) {
                completedDates.push(date);
            }
        }
        completedDates.sort();

        let habitsForSelectedDate: TodoList[] | undefined;
        if (selectedDate) {
            habitsForSelectedDate = await this.deps.getTodoListByDate(userId, selectedDate, categoryId, habitId);
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

        const result: StatsDashboardData = {
            completedDates,
            globalStreak,
            globalLongestStreak,
            globalTotalCompletions,
            lastCompletedDate,
            monthCompletionCount,
            monthCompletionRate,
            daysInMonth,
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
        }

        if (habitId) {
            const habitSk = generateSK("HABIT", habitId, "");
            const habitStats = await this.deps.repository.get(userPk, habitSk);
            result.habitStreak = habitStats?.currentStreak ?? 0;
        }

        return result;
    }
}
