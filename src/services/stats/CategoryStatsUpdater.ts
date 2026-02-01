import { StatsRepository } from "../../repositories/StatsRepository.js";
import { TodoRepository } from "../../repositories/TodoRepository.js";
import { HabitService } from "../HabitService.js";
import { TODO_STATUS } from "../../constants/todo.constants.js";
import { addDays, todayISO } from "../../utils/util.js";
import { logger } from "../../utils/logger.js";
import { computeFullStreakStats } from "./StreakCalculator.js";
import { getCompletedCategoryDatesFromTodoList } from "./completedDates.js";
import { generatePK, generateSK, getEndDate } from "./StatsKeyGenerator.js";
import { datesRange } from "../../utils/util.js";
import type { Stats } from "../../models/Stats.js";
import type { TodoList } from "../../models/TodoList.js";

export interface GetHabitStatsFn {
    (params: { scope: "CATEGORY"; userId: string; habitId: string; categoryId?: string }): Promise<Stats>;
}

export interface GetTodoListByDateFn {
    (userId: string, date: string): Promise<TodoList[]>;
}

export interface CategoryStatsUpdaterParams {
    repository: StatsRepository;
    todoRepository: TodoRepository;
    habitService: HabitService;
    getTodoListByDate: GetTodoListByDateFn;
    getHabitStats: GetHabitStatsFn;
}

export interface UpdateCategoryStatsIncrementalParams {
    userId: string;
    habitId: string;
    categoryId?: string;
    date: string;
}

export class CategoryStatsUpdater {
    constructor(private readonly params: CategoryStatsUpdaterParams) {}

    async updateIncremental(params: UpdateCategoryStatsIncrementalParams): Promise<void> {
        const { repository, getHabitStats } = this.params;
        const { userId, habitId, categoryId, date } = params;

        logger.info(
            `Updating category stats incremental for user ${userId} and category ${categoryId} and date ${date}`
        );

        const isAllTodayComplete = await this.isAllTodoByCategoryCompleted(userId, categoryId ?? "", date);

        let { currentStreak, lastCompletedDate, totalCompletions, longestStreak } = await getHabitStats({
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

        logger.debug("Category stats incremental computed", {
            userId,
            categoryId,
            date,
            isAllTodayComplete,
            computed: { currentStreak, longestStreak, lastCompletedDate, totalCompletions },
        });

        await repository.updateStreakFields(generatePK(userId), generateSK("CATEGORY", habitId, categoryId ?? ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions,
        });
    }

    async recalculate(userId: string, categoryId: string): Promise<void> {
        const { repository, todoRepository, habitService, getHabitStats } = this.params;

        const habits = await this.getHabitsByCategory(userId, categoryId);
        if (habits.length === 0) {
            logger.info("Category stats recalculate skipped: no habits in category", {
                userId,
                categoryId,
            });
            return;
        }

        const today = todayISO();
        const startDate = habits.reduce((min, h) => (h.start_date < min ? h.start_date : min), habits[0].start_date);
        const endDate = getEndDate(habits[0]);
        const todoList = await todoRepository.findAllByDateRange(userId, startDate, endDate);
        const habitIds = new Set(habits.map((h) => h.id));
        const completedDates = getCompletedCategoryDatesFromTodoList(todoList, habitIds);
        const scheduledAsc = datesRange(startDate, today);

        logger.debug("Category recalculate inputs", {
            userId,
            categoryId,
            habitsCount: habits.length,
            startDate,
            endDate,
            completedDatesCount: completedDates.size,
            scheduledDaysCount: scheduledAsc.length,
        });

        const { currentStreak, longestStreak, lastCompletedDate } = computeFullStreakStats(
            scheduledAsc,
            completedDates,
            today
        );

        await repository.updateStreakFields(generatePK(userId), generateSK("CATEGORY", "", categoryId), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions: completedDates.size,
        });
        logger.info(`Category stats updated for ${categoryId}`, { currentStreak, longestStreak });
    }

    private async getHabitsByCategory(userId: string, categoryId: string) {
        const habits = await this.params.habitService.getAllHabits(userId);
        return habits.filter((h) => h.categoryId === categoryId);
    }

    private async isAllTodoByCategoryCompleted(userId: string, categoryId: string, date: string): Promise<boolean> {
        const todoList = await this.params.getTodoListByDate(userId, date);
        const todoByCategory = todoList.filter((todo) => todo.categoryId === categoryId);
        return todoByCategory.length > 0 && todoByCategory.every((t) => t.status === TODO_STATUS.DONE);
    }
}
