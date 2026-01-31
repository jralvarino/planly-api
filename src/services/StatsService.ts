import { StatsRepository, StatsStreakFields } from "../repositories/StatsRepository.js";
import { Stats, StatsScope } from "../models/Stats.js";
import { TODO_STATUS } from "../constants/todo.constants.js";
import { addDays, todayISO } from "../utils/util.js";
import { TodoRepository } from "../repositories/TodoRepository.js";
import { logger } from "../utils/logger.js";
import { InternalServerError } from "../errors/PlanlyError.js";
import { Habit } from "../models/Habit.js";
import { Todo } from "../models/Todo.js";
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

    /** Retorna as datas em que o hábito está DONE na lista de todos. */
    private getCompletedDatesFromTodoList(todos: Todo[], habitId: string): Set<string> {
        return todos.reduce<Set<string>>((set, t) => {
            if (t.habitId === habitId && t.status === TODO_STATUS.DONE) {
                set.add(t.date);
            }
            return set;
        }, new Set());
    }

    /** Retorna a última data agendada estritamente antes de `date`. */
    private async getPreviousScheduledDate(habit: Habit, date: string): Promise<string | undefined> {
        const scheduledDates = await this.habitService.getScheduledDates(habit, date);
        const sorted = [...scheduledDates].sort();
        const before = sorted.filter((d) => d < date);
        return before[before.length - 1] ?? undefined;
    }

    /**
     * Percorre as datas agendadas em ordem e retorna currentStreak, longestStreak e lastCompletedDate.
     * currentStreak = run no fim da lista (trailing run); se houver gap antes do fim, streak = 0.
     * Exceção: se o último dia agendado for `today` e ainda não estiver completo, o streak mostrado
     * é o run anterior (usuário tem até 00:00 para completar, não conta como falha).
     */
    private computeFullStreakStats(
        scheduledAsc: string[],
        completedDates: Set<string>,
        today?: string
    ): { currentStreak: number; longestStreak: number; lastCompletedDate: string | undefined } {
        let longestStreak = 0;
        let run = 0;
        let lastCompletedDate: string | undefined;
        let lastRunLengthWhenGap = 0;

        for (const date of scheduledAsc) {
            if (completedDates.has(date)) {
                run++;
                longestStreak = Math.max(longestStreak, run);
                lastCompletedDate = date;
            } else {
                if (run > 0) lastRunLengthWhenGap = run;
                run = 0;
            }
        }

        const lastScheduled = scheduledAsc[scheduledAsc.length - 1];
        const pendingToday = today != null && lastScheduled === today && !completedDates.has(today);
        const currentStreak = pendingToday ? lastRunLengthWhenGap : run;
        return { currentStreak, longestStreak, lastCompletedDate };
    }

    /**
     * Calcula o streak e a última data completada considerando só datas agendadas até `upToDateInclusive`.
     */
    private computeStreakUpTo(
        scheduledAsc: string[],
        completedDates: Set<string>,
        upToDateInclusive: string
    ): { streak: number; lastCompletedDate: string | undefined } {
        const upTo = scheduledAsc.filter((d) => d <= upToDateInclusive);
        const { currentStreak, lastCompletedDate } = this.computeFullStreakStats(upTo, completedDates);
        return { streak: currentStreak, lastCompletedDate };
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
                await this.recalculateCategoryStats(userId, categoryId);
                await this.recalculateUserStats(userId);
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

        const habit = await this.habitService.getHabitById(userId, habitId);
        const sortedScheduled = [...(await this.habitService.getScheduledDates(habit, date))].sort();
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
                    const todoList = await this.todoRepository.findAllByDateRange(userId, habit.start_date, date);
                    const completedDates = this.getCompletedDatesFromTodoList(todoList, habitId);
                    const { streak, lastCompletedDate: lastInRange } = this.computeStreakUpTo(
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

        const queryEndDate = this.getEndDate(habit);

        const todoList = await this.todoRepository.findAllByDateRange(userId, habit.start_date, queryEndDate);
        const completedDates = this.getCompletedDatesFromTodoList(todoList, habitId);

        const scheduledDates = await this.habitService.getScheduledDates(habit, queryEndDate);

        const sortedAsc = [...scheduledDates].sort();
        const today = todayISO();
        const { currentStreak, longestStreak, lastCompletedDate } = this.computeFullStreakStats(
            sortedAsc,
            completedDates,
            today
        );

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

    private async recalculateCategoryStats(userId: string, categoryId: string): Promise<void> {
        const habits = await this.getHabitsByCategory(userId, categoryId);
        if (habits.length === 0) return;

        const today = todayISO();
        const startDate = habits.reduce((min, h) => (h.start_date < min ? h.start_date : min), habits[0].start_date);
        const endDate = this.getEndDate(habits[0]);
        const todoList = await this.todoRepository.findAllByDateRange(userId, startDate, endDate);
        const habitIds = new Set(habits.map((h) => h.id));
        const completedDates = this.getCompletedCategoryDatesFromTodoList(todoList, habitIds);
        const scheduledAsc = this.datesRange(startDate, today);

        const { currentStreak, longestStreak, lastCompletedDate } = this.computeFullStreakStats(
            scheduledAsc,
            completedDates,
            today
        );

        await this.repository.updateStreakFields(this.generatePK(userId), this.generateSK("CATEGORY", "", categoryId), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions: completedDates.size,
        });
        logger.info(`Category stats updated for ${categoryId}`, { currentStreak, longestStreak });
    }

    private async recalculateUserStats(userId: string): Promise<void> {
        const habits = await this.habitService.getAllHabits(userId);
        if (habits.length === 0) return;

        const today = todayISO();
        const startDate = habits.reduce((min, h) => (h.start_date < min ? h.start_date : min), habits[0].start_date);
        const endDate = today;
        const todoList = await this.todoRepository.findAllByDateRange(userId, startDate, endDate);
        const completedDates = this.getCompletedUserDatesFromTodoList(todoList);
        const scheduledAsc = this.datesRange(startDate, today);

        const { currentStreak, longestStreak, lastCompletedDate } = this.computeFullStreakStats(
            scheduledAsc,
            completedDates,
            today
        );

        await this.repository.updateStreakFields(this.generatePK(userId), this.generateSK("USER", "", ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions: completedDates.size,
        });
        logger.info(`User stats updated for ${userId}`, { currentStreak, longestStreak });
    }

    /** Datas em que todos os TODOs do usuário naquele dia estão DONE. */
    private getCompletedUserDatesFromTodoList(todos: Todo[]): Set<string> {
        const byDate = new Map<string, Todo[]>();
        for (const t of todos) {
            if (!byDate.has(t.date)) byDate.set(t.date, []);
            byDate.get(t.date)!.push(t);
        }
        const completed = new Set<string>();
        for (const [date, list] of byDate) {
            if (list.length > 0 && list.every((t) => t.status === TODO_STATUS.DONE)) {
                completed.add(date);
            }
        }
        return completed;
    }

    private datesRange(startDate: string, endDate: string): string[] {
        const dates: string[] = [];
        let d = startDate;
        while (d <= endDate) {
            dates.push(d);
            d = addDays(d, 1);
        }
        return dates;
    }

    private async getHabitsByCategory(userId: string, categoryId: string): Promise<Habit[]> {
        const habits = await this.habitService.getAllHabits(userId);
        return habits.filter((h) => h.categoryId === categoryId);
    }

    /** Datas em que todos os TODOs da categoria (habitIds) naquele dia estão DONE. */
    private getCompletedCategoryDatesFromTodoList(todos: Todo[], habitIds: Set<string>): Set<string> {
        const byDate = new Map<string, Todo[]>();
        for (const t of todos) {
            if (!habitIds.has(t.habitId)) continue;
            if (!byDate.has(t.date)) byDate.set(t.date, []);
            byDate.get(t.date)!.push(t);
        }
        const completed = new Set<string>();
        for (const [date, list] of byDate) {
            if (list.length > 0 && list.every((t) => t.status === TODO_STATUS.DONE)) {
                completed.add(date);
            }
        }
        return completed;
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

    private getEndDate(habit: Habit): string {
        let endDate = habit.end_date;
        if (!endDate) {
            endDate = todayISO();
        }
        const queryEndDate = todayISO() >= endDate ? todayISO() : endDate;
        return queryEndDate;
    }
}
