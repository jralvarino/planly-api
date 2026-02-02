import { injectable } from "tsyringe";
import { HabitRepository } from "../repositories/HabitRepository.js";
import { Habit } from "../models/Habit.js";
import { TodoList } from "../models/TodoList.js";
import { Todo } from "../models/Todo.js";
import { TodoRepository } from "../repositories/TodoRepository.js";
import { NotFoundError } from "../errors/PlanlyError.js";
import { parseDayOfWeek } from "../utils/util.js";
import { datesRange } from "../utils/util.js";
import { TODO_STATUS, TODO_STATUS_ORDER, TODO_PERIOD_ORDER, TodoStatus } from "../constants/todo.constants.js";
import { StatsService } from "./StatsService.js";
import { logger } from "../utils/logger.js";

export interface UpdateStatusParams {
    userId: string;
    habitId: string;
    date: string;
    status: TodoStatus;
    progressValue?: number;
    notes?: string;
}

@injectable()
export class TodoService {
    constructor(
        private readonly habitRepository: HabitRepository,
        private readonly todoRepository: TodoRepository,
        private readonly statsService: StatsService
    ) {}

    async createOrUpdate(params: UpdateStatusParams): Promise<Todo> {
        const { userId, habitId, date, progressValue, status } = params;

        const habit = await this.habitRepository.findById(habitId);
        if (!habit || habit.userId !== userId) {
            logger.warn("Todo createOrUpdate: habit not found or user mismatch", { userId, habitId });
            throw new NotFoundError(`Habit ${habitId} not found`);
        }

        // Check if todo exists
        const existing = await this.todoRepository.findByUserDateAndHabit(userId, date, habitId);

        const now = new Date().toISOString();
        const habitTargetValue = parseInt(habit.value);

        const todo: Todo = {
            PK: `USER#${userId}`,
            SK: `DATE#${date}#HABIT#${habitId}`,
            userId,
            habitId,
            date,
            status,
            progress: getProgressValue(existing, status, habitTargetValue, progressValue),
            target: habitTargetValue,
            notes: existing?.notes || "",
            completedAt: status === TODO_STATUS.DONE ? now : undefined,
            createdAt: existing?.createdAt || now,
            updatedAt: now,
        };

        await this.todoRepository.createOrUpdate(todo);
        logger.debug("Todo createOrUpdate saved", { userId, habitId, date, status });

        await this.statsService.updateStatsOnTodoStatusChange({
            userId,
            habitId,
            categoryId: habit.categoryId,
            date,
            newStatus: status,
            previousStatus: existing?.status || TODO_STATUS.PENDING,
        });

        return todo;
    }

    async getTodoListByDate(userId: string, date: string, categoryId?: string, habitId?: string): Promise<TodoList[]> {
        const habits = await this.habitRepository.findAllByDate(userId, date);

        const targetDate = new Date(date);

        let eligibleHabits = habits.filter((habit) => isValidForTargetDate(habit, targetDate));
        if (categoryId) {
            eligibleHabits = eligibleHabits.filter((h) => h.categoryId === categoryId);
        }
        if (habitId) {
            eligibleHabits = eligibleHabits.filter((h) => h.id === habitId);
        }

        const todoList: TodoList[] = await Promise.all(
            eligibleHabits.map(async (habit) => {
                const todo = await this.todoRepository.findByUserDateAndHabit(userId, date, habit.id);

                const currentStreak = await this.statsService.getHabitStats({
                    scope: "HABIT",
                    userId,
                    habitId: habit.id,
                    categoryId: habit.categoryId,
                });

                return {
                    id: habit.id,
                    title: habit.title,
                    color: habit.color,
                    emoji: habit.emoji,
                    unit: habit.unit,
                    targetValue: habit.value,
                    period: habit.period,
                    active: habit.active,
                    categoryId: habit.categoryId,
                    status: todo?.status || TODO_STATUS.PENDING,
                    progressValue: todo?.progress?.toString() || "0",
                    notes: todo?.notes || "",
                    completedAt: todo?.completedAt,
                    streak: currentStreak.currentStreak,
                    updatedAt: todo?.updatedAt || habit.updatedAt,
                };
            })
        );

        return todoList.sort((a, b) => {
            const statusA = TODO_STATUS_ORDER[a.status] ?? 999;
            const statusB = TODO_STATUS_ORDER[b.status] ?? 999;
            const statusDiff = statusA - statusB;
            if (statusDiff !== 0) {
                return statusDiff;
            }
            // Same status: for done, order by completedAt; otherwise by period
            if (a.status === TODO_STATUS.DONE && b.status === TODO_STATUS.DONE) {
                const atA = a.completedAt ?? "";
                const atB = b.completedAt ?? "";
                return atA.localeCompare(atB);
            }
            const periodDiff = (TODO_PERIOD_ORDER[a.period] || 999) - (TODO_PERIOD_ORDER[b.period] || 999);
            return periodDiff;
        });
    }

    async getDailySummary(userId: string, startDate: string, endDate: string) {
        const dates = datesRange(startDate, endDate);

        const dailyStats = await Promise.all(
            dates.map(async (date) => {
                // Fetch all valid habits for this date
                const todoList: TodoList[] = await this.getTodoListByDate(userId, date);

                // Estatísticas gerais
                const done = todoList.filter((t) => t.status === TODO_STATUS.DONE).length;
                const skipped = todoList.filter((t) => t.status === TODO_STATUS.SKIPPED).length;
                const pending = todoList.filter((t) => t.status === TODO_STATUS.PENDING).length;
                const total = todoList.length;

                // Agrupar por categoria
                const todosByCategory: Record<string, TodoList[]> = {};
                todoList.forEach((todo) => {
                    if (!todosByCategory[todo.categoryId]) {
                        todosByCategory[todo.categoryId] = [];
                    }
                    todosByCategory[todo.categoryId].push(todo);
                });

                // Compute stats per category
                const categories = Object.entries(todosByCategory).map(([categoryId, categoryTodos]) => {
                    const categoryDone = categoryTodos.filter((t) => t.status === TODO_STATUS.DONE).length;
                    const categorySkipped = categoryTodos.filter((t) => t.status === TODO_STATUS.SKIPPED).length;
                    const categoryPending = categoryTodos.filter((t) => t.status === TODO_STATUS.PENDING).length;
                    const categoryTotal = categoryTodos.length;

                    return {
                        categoryId,
                        done: categoryDone,
                        skipped: categorySkipped,
                        pending: categoryPending,
                        total: categoryTotal,
                    };
                });

                return {
                    date,
                    total: {
                        done,
                        skipped,
                        pending,
                        total,
                    },
                    categories,
                };
            })
        );

        return dailyStats;
    }

    async updateNotes(userId: string, habitId: string, date: string, notes: string): Promise<void> {
        const habit = await this.habitRepository.findById(habitId);
        if (!habit || habit.userId !== userId) {
            logger.warn("Todo updateNotes: habit not found or user mismatch", { userId, habitId });
            throw new NotFoundError(`Habit ${habitId} not found`);
        }

        const existing = await this.todoRepository.findByUserDateAndHabit(userId, date, habitId);
        if (!existing) {
            logger.debug("Todo updateNotes: no todo exists, creating with PENDING", { userId, habitId, date });
            await this.createOrUpdate({ userId, habitId, date, status: TODO_STATUS.PENDING, progressValue: 0 });
        } else {
            await this.todoRepository.updateNotes(userId, date, habitId, notes);
        }
    }
}

function getProgressValue(
    existingTodo: Todo | null,
    status: string,
    habitTargetValue: number,
    progressValue: number | undefined
) {
    if (existingTodo && existingTodo.status === TODO_STATUS.DONE && status !== TODO_STATUS.DONE) {
        return 0;
    }
    if (status === TODO_STATUS.DONE) {
        return habitTargetValue;
    }
    if (status === TODO_STATUS.SKIPPED) {
        return 0;
    }
    if (progressValue) {
        return progressValue;
    }
    return 0;
}

export function isValidForTargetDate(habit: Habit, date: Date): boolean {
    const targetDate = date.toISOString().split("T")[0];

    if (habit.end_date) {
        const endDate = habit.end_date.split("T")[0];
        if (targetDate > endDate) {
            return false;
        }
    }

    switch (habit.period_type) {
        case "every_day":
            return true;
        case "specific_days_week": {
            if (!habit.period_value) {
                return false;
            }
            const allowedDays = habit.period_value
                .split(",")
                .map((d) => parseDayOfWeek(d))
                .filter((d): d is number => d !== null);

            const dayOfWeek = date.getDay();

            return allowedDays.includes(dayOfWeek);
        }
        case "specific_days_month": {
            if (!habit.period_value) {
                return false;
            }
            const allowedDays = habit.period_value.split(",").map((d) => parseInt(d.trim()));
            const dayOfMonth = date.getDate();
            return allowedDays.includes(dayOfMonth);
        }
        default:
            return false;
    }
}
