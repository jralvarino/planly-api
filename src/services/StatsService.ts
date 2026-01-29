import { StatsRepository } from "../repositories/StatsRepository.js";
import { Stats, StatsScope } from "../models/Stats.js";
import { HabitRepository } from "../repositories/HabitRepository.js";
import { TodoRepository } from "../repositories/TodoRepository.js";
import { getDateRange, computeStreakFromDailyCompletion } from "../utils/streak.util.js";
import { filterEligibleHabits } from "../utils/habitDate.util.js";
import { TODO_STATUS } from "../constants/todo.constants.js";
import { addDays, todayISO } from "../utils/util.js";

async function getEligibleHabitsForDate(habitRepository: HabitRepository, userId: string, date: string) {
    const habits = await habitRepository.findAllByDate(userId, date);
    return filterEligibleHabits(habits, new Date(date));
}

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
export class StatsService {
    private repository = new StatsRepository();
    private habitRepository = new HabitRepository();
    private todoRepository = new TodoRepository();

    async getGlobalStreak(userId: string): Promise<number> {
        const stats = await this.repository.get(userId, "USER");
        return stats?.currentStreak ?? 0;
    }

    async getHabitStreak(userId: string, habitId: string): Promise<number> {
        const stats = await this.repository.get(userId, "HABIT", habitId);
        return stats?.currentStreak ?? 0;
    }

    async createStats(userId: string, habitId: string, categoryId: string): Promise<Stats[]> {
        const now = new Date().toISOString();
        const created: Stats[] = [];

        const habitStats: Stats = {
            PK: this.generatePK(userId),
            SK: this.generateSK("HABIT", habitId, undefined),
            habitId,
            userId,
            categoryId,
            scope: "HABIT",
            currentStreak: 0,
            longestStreak: 0,
            totalCompletions: 0,
            createdAt: now,
            updatedAt: now,
        };
        await this.repository.create(habitStats);
        created.push(habitStats);

        const existingCategory = await this.repository.get(userId, "CATEGORY", undefined, categoryId);
        if (!existingCategory) {
            const categoryStats: Stats = {
                PK: this.generatePK(userId),
                SK: this.generateSK("CATEGORY", undefined, categoryId),
                habitId,
                userId,
                categoryId,
                scope: "CATEGORY",
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
                createdAt: now,
                updatedAt: now,
            };
            await this.repository.create(categoryStats);
            created.push(categoryStats);
        }

        const existingUser = await this.repository.get(userId, "USER");
        if (!existingUser) {
            const userStats: Stats = {
                PK: this.generatePK(userId),
                SK: this.generateSK("USER"),
                habitId,
                userId,
                categoryId,
                scope: "USER",
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
                createdAt: now,
                updatedAt: now,
            };
            await this.repository.create(userStats);
            created.push(userStats);
        }

        return created;
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

        const today = todayISO();
        const yesterday = addDays(today, -1);

        if (date === today) {
            await this.updateHabitStatsIncremental({ userId, habitId, date, newStatus, previousStatus });
        } else {
            // recalculate stats from date
        }
    }

    async updateHabitStatsIncremental({
        userId,
        habitId,
        date,
        newStatus,
        previousStatus,
    }: UpdateStatsIncrementalParams): Promise<void> {
        const habitStats = await this.repository.get(userId, "HABIT", habitId);
        const now = new Date().toISOString();

        let currentStreak = habitStats?.currentStreak ?? 0;
        let lastCompletedDate = habitStats?.lastCompletedDate;
        let lastStreakStartDate = habitStats?.lastStreakStartDate;
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
                lastStreakStartDate = date;
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
                    lastStreakStartDate = undefined;
                }
            }
        }

        const longestStreak = Math.max(habitStats?.longestStreak ?? 0, currentStreak);

        await this.repository.updateStreakFields(
            userId,
             "HABIT",
            {
                currentStreak,
                longestStreak,
                lastCompletedDate,
                lastStreakStartDate,
                totalCompletions,
            },
            habitId
        );
    }

    //Refactor
    //
    //
    //
    ///
    //
    //
    //

    async updateStatsOnTodoChange(
        userId: string,
        habitId: string,
        categoryId: string,
        date: string,
        newStatus: string,
        previousStatus?: string
    ): Promise<void> {
        if (newStatus === previousStatus) {
            return;
        }

        const today = todayISO();
        const yesterday = addDays(today, -1);
        const isDistantPast = date < yesterday; // Apenas datas anteriores a "ontem" precisam recálculo

        if (isDistantPast) {
            // Alteração no passado: recalc a partir da menor data em que o hábito foi PENDING/SKIPPED (ou um dia antes + currentStreak), não do start_date.
            const habit = await this.habitRepository.findById(habitId);
            const habitStartDate = habit?.start_date?.split("T")[0] ?? date;
            const existingStats = await this.repository.get(userId, "HABIT", habitId);
            const minNotDoneDate = await this.todoRepository.findMinDateByHabitWhereNotDone(
                userId,
                habitId,
                habitStartDate,
                date
            );
            const anchor = minNotDoneDate ?? date;
            const backOff = 1 + (existingStats?.currentStreak ?? 0);
            const fromDateCand = addDays(anchor, -backOff);
            const fromDate = fromDateCand < habitStartDate ? habitStartDate : fromDateCand;
            const deltaDone = newStatus === TODO_STATUS.DONE ? 1 : previousStatus === TODO_STATUS.DONE ? -1 : 0;
            await this.recalcHabitStatsFromDate(userId, habitId, fromDate, today, deltaDone);
            await this.recalcCategoryStatsFromDate(userId, categoryId, fromDate, today);
            await this.recalcUserStatsFromDate(userId, fromDate, today);
        } else {
            // Hoje ou ontem: usar atualização incremental (mais eficiente)
            //await this.updateHabitStatsIncremental(userId, habitId, date, newStatus, previousStatus, today);
            await this.updateCategoryStatsIncremental(userId, categoryId, date, today);
            await this.updateUserStatsIncremental(userId, date, today);
        }
    }

    async recalcStatsForHabitAndCategory(
        userId: string,
        habitId: string,
        categoryId: string,
        fromDate: string
    ): Promise<void> {
        const today = todayISO();
        await this.recalcHabitStatsFromDate(userId, habitId, fromDate, today, undefined);
        await this.recalcCategoryStatsFromDate(userId, categoryId, fromDate, today);
        await this.recalcUserStatsFromDate(userId, fromDate, today);
    }

    async processDayWithoutActions(date: string, userIds: string[]): Promise<void> {
        for (const userId of userIds) {
            await this.applyDayCompletionForUser(userId, date);
        }
    }



    /** Verifica se a data está "completa" (todos os hábitos da categoria DONE) e atualiza Stats incremental. */
    private async updateCategoryStatsIncremental(
        userId: string,
        categoryId: string,
        date: string,
        today: string
    ): Promise<void> {
        const eligible = await getEligibleHabitsForDate(this.habitRepository, userId, date);
        const inCategory = eligible.filter((h) => h.categoryId === categoryId);
        if (inCategory.length === 0) return;

        const todos = await this.todoRepository.findAllByDateRange(userId, date, date);
        const todoByHabit = new Map(todos.map((t) => [t.habitId, t]));
        const allDone = inCategory.every((h) => todoByHabit.get(h.id)?.status === TODO_STATUS.DONE);

        const existing = await this.repository.get(userId, "CATEGORY", undefined, categoryId);
        const now = new Date().toISOString();
        const yesterday = addDays(date, -1);
        let currentStreak = existing?.currentStreak ?? 0;
        let lastCompletedDate = existing?.lastCompletedDate;
        let lastStreakStartDate = existing?.lastStreakStartDate;

        if (allDone) {
            if (lastCompletedDate === yesterday) {
                currentStreak++;
                lastCompletedDate = date;
            } else {
                currentStreak = 1;
                lastCompletedDate = date;
                lastStreakStartDate = date;
            }
        } else if (lastCompletedDate === date) {
            currentStreak = 0;
            lastCompletedDate = undefined;
            lastStreakStartDate = undefined;
        }

        const longestStreak = Math.max(existing?.longestStreak ?? 0, currentStreak);
        const stats: Stats = {
            PK: this.generatePK(userId),
            SK: this.generateSK("CATEGORY", undefined, categoryId),
            habitId: existing?.habitId ?? "",
            userId,
            categoryId,
            scope: "CATEGORY",
            currentStreak,
            longestStreak,
            lastCompletedDate,
            lastStreakStartDate,
            totalCompletions: existing?.totalCompletions ?? 0,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        await this.repository.update(stats);
    }

    /** Verifica se a data está "completa" (todos os hábitos DONE) e atualiza Stats USER incremental. */
    private async updateUserStatsIncremental(userId: string, date: string, today: string): Promise<void> {
        const eligible = await getEligibleHabitsForDate(this.habitRepository, userId, date);
        if (eligible.length === 0) return;

        const todos = await this.todoRepository.findAllByDateRange(userId, date, date);
        const todoByHabit = new Map(todos.map((t) => [t.habitId, t]));
        const allDone = eligible.every((h) => todoByHabit.get(h.id)?.status === TODO_STATUS.DONE);

        const existing = await this.repository.get(userId, "USER");
        const now = new Date().toISOString();
        const yesterday = addDays(date, -1);
        let currentStreak = existing?.currentStreak ?? 0;
        let lastCompletedDate = existing?.lastCompletedDate;
        let lastStreakStartDate = existing?.lastStreakStartDate;

        if (allDone) {
            if (lastCompletedDate === yesterday) {
                currentStreak++;
                lastCompletedDate = date;
            } else {
                currentStreak = 1;
                lastCompletedDate = date;
                lastStreakStartDate = date;
            }
        } else if (lastCompletedDate === date) {
            currentStreak = 0;
            lastCompletedDate = undefined;
            lastStreakStartDate = undefined;
        }

        const longestStreak = Math.max(existing?.longestStreak ?? 0, currentStreak);
        const stats: Stats = {
            PK: this.generatePK(userId),
            SK: this.generateSK("USER"),
            habitId: existing?.habitId ?? "",
            userId,
            categoryId: existing?.categoryId ?? "",
            scope: "USER",
            currentStreak,
            longestStreak,
            lastCompletedDate,
            lastStreakStartDate,
            totalCompletions: existing?.totalCompletions ?? 0,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        await this.repository.update(stats);
    }

    private async recalcHabitStatsFromDate(
        userId: string,
        habitId: string,
        fromDate: string,
        toDate: string,
        totalCompletionsDelta?: number
    ): Promise<void> {
        const dates = getDateRange(fromDate, toDate);
        const todos = await this.todoRepository.findAllByDateRange(userId, fromDate, toDate);
        const habitTodos = todos.filter((t) => t.habitId === habitId);
        const completedDates = new Set(habitTodos.filter((t) => t.status === TODO_STATUS.DONE).map((t) => t.date));

        const result = computeStreakFromDailyCompletion(dates, completedDates, toDate);

        const existing = await this.repository.get(userId, "HABIT", habitId);
        let totalCompletions = existing?.totalCompletions ?? 0;
        if (totalCompletionsDelta !== undefined) {
            totalCompletions = Math.max(0, totalCompletions + totalCompletionsDelta);
        } else {
            totalCompletions = completedDates.size;
        }

        const now = new Date().toISOString();
        const stats: Stats = {
            PK: this.generatePK(userId),
            SK: this.generateSK("HABIT", habitId, undefined),
            habitId,
            userId,
            categoryId: existing?.categoryId ?? "",
            scope: "HABIT",
            currentStreak: result.currentStreak,
            longestStreak: Math.max(existing?.longestStreak ?? 0, result.longestStreak),
            lastCompletedDate: result.lastCompletedDate,
            lastStreakStartDate: result.lastStreakStartDate,
            totalCompletions,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        await this.repository.update(stats);
    }

    private async recalcCategoryStatsFromDate(
        userId: string,
        categoryId: string,
        fromDate: string,
        toDate: string
    ): Promise<void> {
        const dates = getDateRange(fromDate, toDate);
        const completedByDate = new Set<string>();

        for (const date of dates) {
            const eligible = await getEligibleHabitsForDate(this.habitRepository, userId, date);
            const inCategory = eligible.filter((h) => h.categoryId === categoryId);
            if (inCategory.length === 0) continue;

            const todos = await this.todoRepository.findAllByDateRange(userId, date, date);
            const todoByHabit = new Map(todos.map((t) => [t.habitId, t]));
            const allDone = inCategory.every((h) => todoByHabit.get(h.id)?.status === TODO_STATUS.DONE);
            if (allDone) completedByDate.add(date);
        }

        const result = computeStreakFromDailyCompletion(dates, completedByDate, toDate);
        const existing = await this.repository.get(userId, "CATEGORY", undefined, categoryId);
        const now = new Date().toISOString();
        const stats: Stats = {
            PK: this.generatePK(userId),
            SK: this.generateSK("CATEGORY", undefined, categoryId),
            habitId: existing?.habitId ?? "",
            userId,
            categoryId,
            scope: "CATEGORY",
            currentStreak: result.currentStreak,
            longestStreak: Math.max(existing?.longestStreak ?? 0, result.longestStreak),
            lastCompletedDate: result.lastCompletedDate,
            lastStreakStartDate: result.lastStreakStartDate,
            totalCompletions: existing?.totalCompletions ?? 0,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        await this.repository.update(stats);
    }

    private async recalcUserStatsFromDate(userId: string, fromDate: string, toDate: string): Promise<void> {
        const dates = getDateRange(fromDate, toDate);
        const completedByDate = new Set<string>();

        for (const date of dates) {
            const eligible = await getEligibleHabitsForDate(this.habitRepository, userId, date);
            if (eligible.length === 0) continue;

            const todos = await this.todoRepository.findAllByDateRange(userId, date, date);
            const todoByHabit = new Map(todos.map((t) => [t.habitId, t]));
            const allDone = eligible.every((h) => todoByHabit.get(h.id)?.status === TODO_STATUS.DONE);
            if (allDone) completedByDate.add(date);
        }

        const result = computeStreakFromDailyCompletion(dates, completedByDate, toDate);
        const existing = await this.repository.get(userId, "USER");
        const now = new Date().toISOString();
        const stats: Stats = {
            PK: this.generatePK(userId),
            SK: this.generateSK("USER"),
            habitId: existing?.habitId ?? "",
            userId,
            categoryId: existing?.categoryId ?? "",
            scope: "USER",
            currentStreak: result.currentStreak,
            longestStreak: Math.max(existing?.longestStreak ?? 0, result.longestStreak),
            lastCompletedDate: result.lastCompletedDate,
            lastStreakStartDate: result.lastStreakStartDate,
            totalCompletions: existing?.totalCompletions ?? 0,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
        };
        await this.repository.update(stats);
    }

    private async applyDayCompletionForUser(userId: string, date: string): Promise<void> {
        const eligible = await getEligibleHabitsForDate(this.habitRepository, userId, date);
        const todos = await this.todoRepository.findAllByDateRange(userId, date, date);
        const todoByHabit = new Map(todos.map((t) => [t.habitId, t]));

        for (const habit of eligible) {
            const todo = todoByHabit.get(habit.id);
            if (todo?.status === TODO_STATUS.DONE) continue;
            await this.recalcHabitStatsFromDate(userId, habit.id, date, todayISO(), undefined);
        }

        const categoryIds = [...new Set(eligible.map((h) => h.categoryId).filter(Boolean))];
        for (const categoryId of categoryIds) {
            await this.recalcCategoryStatsFromDate(userId, categoryId, date, todayISO());
        }
        await this.recalcUserStatsFromDate(userId, date, todayISO());
    }

    private generatePK(userId: string): string {
        return `USER#${userId}`;
    }

    private generateSK(scope: StatsScope, habitId?: string, categoryId?: string): string {
        switch (scope) {
            case "HABIT":
                return `STATS#HABIT#${habitId ?? ""}`;
            case "CATEGORY":
                return `STATS#CATEGORY#${categoryId ?? ""}`;
            case "USER":
                return "STATS#USER";
            default:
                throw new Error(`Invalid scope: ${scope}`);
        }
    }
}
