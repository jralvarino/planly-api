import { injectable } from "tsyringe";
import { HabitRepository } from "../repositories/HabitRepository.js";
import { Habit } from "../models/Habit.js";
import { NotFoundError } from "../errors/PlanlyError.js";
import { v4 as uuidv4 } from "uuid";
import { StatsService } from "./StatsService.js";
import { TodoRepository } from "../repositories/TodoRepository.js";
import { isValidForTargetDate } from "./TodoService.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";
import { todayISO } from "../utils/util.js";

@injectable()
export class HabitService {
    private _statsService: StatsService | null = null;

    constructor(
        private readonly repository: HabitRepository,
        private readonly todoRepository: TodoRepository
    ) {}

    private get statsService(): StatsService {
        if (!this._statsService) {
            this._statsService = container.resolve(StatsService);
        }
        return this._statsService;
    }

    async create(userId: string, habitData: Partial<Habit>): Promise<Habit> {
        const now = new Date().toISOString();
        const id = uuidv4();

        const habit: Habit = {
            id,
            userId,
            title: habitData.title || "",
            description: habitData.description,
            color: habitData.color || "#000000",
            emoji: habitData.emoji || "📝",
            unit: habitData.unit || "count",
            value: habitData.value || "1",
            period_type: habitData.period_type || "every_day",
            period_value: habitData.period_value || "",
            categoryId: habitData.categoryId || "",
            period: habitData.period || "Anytime",
            reminder_time: habitData.reminder_time || "",
            start_date: habitData.start_date || now,
            end_date: habitData.end_date || "",
            active: habitData.active !== undefined ? habitData.active : true,
            createdAt: now,
            updatedAt: now,
        } as Habit;

        await this.repository.create(habit);
        logger.debug("Habit created", { userId, habitId: id, categoryId: habit.categoryId });

        await this.statsService.createStats(userId, id, habit.categoryId);

        const startDateOnly = habit.start_date.slice(0, 10);
        const today = todayISO();
        if (startDateOnly <= today) {
            await this.statsService.recalculateStatsOnHabitCreated(userId, id, habit.categoryId);
        }

        return habit;
    }

    async getAllHabits(userId: string, categoryId?: string): Promise<Habit[]> {
        const habits = await this.repository.findAllByUserId(userId);
        if (categoryId) {
            return habits.filter((h) => h.categoryId === categoryId);
        }
        return habits;
    }

    async getHabitById(userId: string, id: string): Promise<Habit> {
        const habit = await this.repository.findById(id);

        if (!habit) {
            logger.warn("Habit getById: not found", { userId, habitId: id });
            throw new NotFoundError(`Habit ${id} could not be found`);
        }

        if (habit.userId !== userId) {
            logger.warn("Habit getById: user mismatch", { userId, habitId: id });
            throw new NotFoundError(`Habit ${id} could not be found for user ${userId}`);
        }

        return habit;
    }

    async update(userId: string, id: string, habitData: Partial<Habit>): Promise<Habit> {
        const existingHabit = await this.repository.findById(id);

        if (!existingHabit) {
            logger.warn("Habit update: not found", { userId, habitId: id });
            throw new NotFoundError(`Habit ${id} could not be found`);
        }

        if (existingHabit.userId !== userId) {
            logger.warn("Habit update: user mismatch", { userId, habitId: id });
            throw new NotFoundError(`Habit ${id} could not be found for user ${userId}`);
        }

        const updatedHabit: Habit = {
            ...existingHabit,
            ...habitData,
            id: existingHabit.id,
            userId: existingHabit.userId,
        };

        await this.repository.update(updatedHabit);

        const statsAffectingFields = [
            "start_date",
            "end_date",
            "period_type",
            "period_value",
            "categoryId",
        ] as const;
        const hasStatsRelevantChange = statsAffectingFields.some(
            (field) =>
                String(existingHabit[field] ?? "") !== String(updatedHabit[field] ?? "")
        );
        if (hasStatsRelevantChange) {
            await this.statsService.recalculateStatsOnHabitEdited(
                userId,
                id,
                existingHabit.categoryId ?? "",
                updatedHabit.categoryId ?? ""
            );
        }

        return updatedHabit;
    }

    async delete(userId: string, id: string): Promise<void> {
        const habit = await this.repository.findById(id);

        if (!habit) {
            logger.warn("Habit delete: not found", { userId, habitId: id });
            throw new NotFoundError("Habit not found");
        }

        if (habit.userId !== userId) {
            logger.warn("Habit delete: user mismatch", { userId, habitId: id });
            throw new NotFoundError(`Habit ${id} could not be found for user ${userId}`);
        }

        await this.repository.delete(id);
        logger.debug("Habit deleted", { userId, habitId: id });
    }

    async getScheduledDates(habit: Habit, endDate: string): Promise<string[]> {
        const todoValidList: string[] = [];
        let currentDate = habit.start_date;

        while (currentDate <= endDate) {
            const [y, m, d] = currentDate.split("-").map(Number);
            const currentDateObj = new Date(y, m - 1, d);
            if (isValidForTargetDate(habit, currentDateObj)) {
                todoValidList.push(currentDate);
            }
            const next = new Date(y, m - 1, d);
            next.setDate(next.getDate() + 1);
            currentDate = next.toISOString().slice(0, 10);
        }

        return todoValidList;
    }
}
