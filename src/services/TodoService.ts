import { HabitRepository } from "../repositories/HabitRepository.js";
import { Habit } from "../models/Habit.js";
import { TodoList } from "../models/TodoList.js";
import { Todo } from "../models/Todo.js";
import { TodoRepository } from "../repositories/TodoRepository.js";
import { NotFoundError } from "../errors/PlanlyError.js";
import { parseDayOfWeek } from "../utils/util.js";
import { TODO_STATUS, TodoStatus } from "../constants/todo.constants.js";

export interface UpdateStatusParams {
    userId: string;
    habitId: string;
    date: string;
    status: TodoStatus;
    progressValue?: number;
    notes?: string;
}

export class TodoService {
    private habitRepository = new HabitRepository();
    private todoRepository = new TodoRepository();

    async createOrUpdate(params: UpdateStatusParams): Promise<Todo> {
        const { userId, habitId, date, progressValue, status } = params;

        // Verificar se o hábito existe e pertence ao usuário
        const habit = await this.habitRepository.findById(habitId);
        if (!habit || habit.userId !== userId) {
            throw new NotFoundError(`Habit ${habitId} not found`);
        }

        // Verificar se o todo existe
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
            createdAt: existing?.createdAt || now,
            updatedAt: now,
        };

        //It will create a new item if it doesn't exist or update the existing one
        await this.todoRepository.createOrUpdate(todo);
        return todo;
    }

    async getTodoListByDate(userId: string, date: string): Promise<TodoList[]> {
        // Buscar todos os hábitos do usuário dentro da data informada
        const habits = await this.habitRepository.findAllByDate(userId, date);

        const targetDate = new Date(date);

        const elegibleHabits = habits.filter((habit) => isValidForTargetDate(habit, targetDate));

        const todoList: TodoList[] = await Promise.all(
            elegibleHabits.map(async (habit) => {
                const todo = await this.todoRepository.findByUserDateAndHabit(userId, date, habit.id);

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
                    updatedAt: todo?.updatedAt || habit.updatedAt,
                };
            })
        );

        // Ordenar: 1) pending primeiro, done por último; 2) depois por period (Morning, Afternoon, Evening, Anytime)
        const periodOrder: Record<string, number> = {
            Morning: 1,
            Afternoon: 2,
            Evening: 3,
            Anytime: 4,
        };

        return todoList.sort((a, b) => {
            // Primeiro ordena por status: pending (0) primeiro, skiped (1) no meio, done (2) por último
            const statusOrder: Record<TodoStatus, number> = {
                [TODO_STATUS.PENDING]: 0,
                [TODO_STATUS.SKIPPED]: 1,
                [TODO_STATUS.DONE]: 2,
            };
            const statusA = statusOrder[a.status] ?? 999;
            const statusB = statusOrder[b.status] ?? 999;
            const statusDiff = statusA - statusB;
            if (statusDiff !== 0) {
                return statusDiff;
            }
            // Se o status for igual, ordena por period
            const periodDiff = (periodOrder[a.period] || 999) - (periodOrder[b.period] || 999);
            return periodDiff;
        });
    }

    async getDailySummary(userId: string, startDate: string, endDate: string) {
        // Gerar range de datas
        const start = new Date(startDate);
        const end = new Date(endDate);
        const dates: string[] = [];
        const currentDate = new Date(start);

        while (currentDate <= end) {
            dates.push(currentDate.toISOString().split("T")[0]);
            currentDate.setDate(currentDate.getDate() + 1);
        }

        const dailyStats = await Promise.all(
            dates.map(async (date) => {
                // Buscar todos os hábitos válidos para esta data
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

                // Calcular estatísticas por categoria
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
        // Verificar se o hábito existe e pertence ao usuário
        const habit = await this.habitRepository.findById(habitId);
        if (!habit || habit.userId !== userId) {
            throw new NotFoundError(`Habit ${habitId} not found`);
        }

        // Verificar se o todo existe
        const existing = await this.todoRepository.findByUserDateAndHabit(userId, date, habitId);
        if (!existing) {
            await this.createOrUpdate({ userId, habitId, date, status: TODO_STATUS.PENDING, progressValue: 0 });
        } else {
            // Atualizar apenas o notes
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

function isValidForTargetDate(habit: Habit, date: Date): boolean {
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
