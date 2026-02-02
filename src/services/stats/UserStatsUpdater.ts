import { StatsRepository } from "../../repositories/StatsRepository.js";
import { TodoRepository } from "../../repositories/TodoRepository.js";
import { HabitService } from "../HabitService.js";
import { TODO_STATUS } from "../../constants/todo.constants.js";
import { addDays, todayISO } from "../../utils/util.js";
import { logger } from "../../utils/logger.js";
import { computeFullStreakStats } from "./StreakCalculator.js";
import { generatePK, generateSK } from "./StatsKeyGenerator.js";
import { datesRange } from "../../utils/util.js";
import type { Stats } from "../../models/Stats.js";
import type { TodoList } from "../../models/TodoList.js";
import type { Todo } from "../../models/Todo.js";
import type { Habit } from "../../models/Habit.js";
import { isValidForTargetDate } from "../TodoService.js";

export interface GetHabitStatsFn {
    (params: { scope: "USER"; userId: string; habitId: string; categoryId?: string }): Promise<Stats>;
}

export interface GetTodoListByDateFn {
    (userId: string, date: string): Promise<TodoList[]>;
}

export interface UserStatsUpdaterParams {
    repository: StatsRepository;
    todoRepository: TodoRepository;
    habitService: HabitService;
    getTodoListByDate: GetTodoListByDateFn;
    getHabitStats: GetHabitStatsFn;
}

export interface UpdateUserStatsIncrementalParams {
    userId: string;
    habitId: string;
    date: string;
}

export class UserStatsUpdater {
    constructor(private readonly params: UserStatsUpdaterParams) {}

    async updateIncremental(params: UpdateUserStatsIncrementalParams): Promise<void> {
        const { repository, getHabitStats } = this.params;
        const { userId, habitId, date } = params;

        logger.info(`Updating user stats incremental for user ${userId} and date ${date}`);

        const isAllTodayComplete = await this.isAllTodoByUserCompleted(userId, date);

        let { currentStreak, lastCompletedDate, totalCompletions, longestStreak } = await getHabitStats({
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

        logger.debug("User stats incremental computed", {
            userId,
            date,
            isAllTodayComplete,
            computed: { currentStreak, longestStreak, lastCompletedDate, totalCompletions },
        });

        await repository.updateStreakFields(generatePK(userId), generateSK("USER", habitId, ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions,
        });
    }

    async recalculate(userId: string): Promise<void> {
        const { repository, todoRepository, habitService } = this.params;

        const habits = await habitService.getAllHabits(userId);
        if (habits.length === 0) {
            logger.info("User stats recalculate skipped: no habits", { userId });
            return;
        }

        const activeHabits = habits.filter((h) => h.active);
        if (activeHabits.length === 0) {
            logger.info("User stats recalculate skipped: no active habits", { userId });
            return;
        }

        const today = todayISO();
        const startDate = activeHabits.reduce(
            (min, h) => (h.start_date < min ? h.start_date : min),
            activeHabits[0].start_date
        );
        const endDate = today;
        const allDates = datesRange(startDate, today);

        const todos = await todoRepository.findAllByDateRange(userId, startDate, endDate);
        const todosByDateAndHabit = this.buildTodoMap(todos);

        const { completedDates, scheduledDates } = this.getCompletedAndScheduledDates(
            allDates,
            activeHabits,
            todosByDateAndHabit
        );

        const { currentStreak, longestStreak, lastCompletedDate } = computeFullStreakStats(
            scheduledDates,
            completedDates,
            today
        );

        await repository.updateStreakFields(generatePK(userId), generateSK("USER", "", ""), {
            currentStreak,
            longestStreak,
            lastCompletedDate,
            totalCompletions: completedDates.size,
        });
        logger.info(`User stats updated for ${userId}`, { currentStreak, longestStreak });
    }

    private buildTodoMap(todos: Todo[]): Map<string, Map<string, Todo>> {
        const map = new Map<string, Map<string, Todo>>();
        for (const todo of todos) {
            if (!map.has(todo.date)) {
                map.set(todo.date, new Map());
            }
            map.get(todo.date)!.set(todo.habitId, todo);
        }
        return map;
    }

    /**
     * Returns completed dates and scheduled dates. A date is "scheduled" if at least one habit
     * was scheduled for it. A date is "completed" only if ALL scheduled habits have a DONE TODO.
     * Dates with zero scheduled habits are excluded from both (they do not affect the streak).
     */
    private getCompletedAndScheduledDates(
        dates: string[],
        activeHabits: Habit[],
        todoMap: Map<string, Map<string, Todo>>
    ): { completedDates: Set<string>; scheduledDates: string[] } {
        const completed = new Set<string>();
        const scheduled: string[] = [];

        for (const dateStr of dates) {
            const targetDate = new Date(dateStr);
            const scheduledHabits = activeHabits.filter((h) => {
                const hStart = h.start_date.slice(0, 10);
                if (hStart > dateStr) return false;
                if (h.end_date) {
                    const hEnd = h.end_date.slice(0, 10);
                    if (hEnd < dateStr) return false;
                }
                return isValidForTargetDate(h, targetDate);
            });

            if (scheduledHabits.length === 0) {
                continue;
            }

            scheduled.push(dateStr);

            const todosForDate = todoMap.get(dateStr);
            if (!todosForDate) {
                continue;
            }

            const allDone = scheduledHabits.every((habit) => {
                const todo = todosForDate.get(habit.id);
                return todo && todo.status === TODO_STATUS.DONE;
            });

            if (allDone) {
                completed.add(dateStr);
            }
        }

        return { completedDates: completed, scheduledDates: scheduled };
    }

    private async isAllTodoByUserCompleted(userId: string, date: string): Promise<boolean> {
        const todoList = await this.params.getTodoListByDate(userId, date);
        return todoList.length > 0 && todoList.every((t) => t.status === TODO_STATUS.DONE);
    }
}
