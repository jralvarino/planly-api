import { HabitRepository } from "../repositories/HabitRepository.js";
import { Habit } from "../models/Habit.js";
import { NotFoundError } from "../errors/PlanlyError.js";
import { v4 as uuidv4 } from "uuid";
import { StatsService } from "./StatsService.js";

export class HabitService {
    private repository = new HabitRepository();
    private statsService = new StatsService();

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

        this.statsService.createStats(userId, id, habit.categoryId);

        return habit;
    }

    async getAllHabits(userId: string): Promise<Habit[]> {
        return await this.repository.findAllByUserId(userId);
    }

    async getHabitById(userId: string, id: string): Promise<Habit> {
        const habit = await this.repository.findById(id);

        if (!habit) {
            throw new NotFoundError(`Habit ${id} could not be found`);
        }

        if (habit.userId !== userId) {
            throw new NotFoundError(`Habit ${id} could not be found for user ${userId}`);
        }

        return habit;
    }

    async update(userId: string, id: string, habitData: Partial<Habit>): Promise<Habit> {
        const existingHabit = await this.repository.findById(id);

        if (!existingHabit) {
            throw new NotFoundError(`Habit ${id} could not be found`);
        }

        if (existingHabit.userId !== userId) {
            throw new NotFoundError(`Habit ${id} could not be found for user ${userId}`);
        }

        const updatedHabit: Habit = {
            ...existingHabit,
            ...habitData,
            id: existingHabit.id, // Garantir que o id não seja alterado
            userId: existingHabit.userId, // Garantir que o userId não seja alterado
        };

        await this.repository.update(updatedHabit);

        const startDateChanged =
            habitData.start_date !== undefined && habitData.start_date !== existingHabit.start_date;
        if (startDateChanged) {
            await this.statsService.recalcStatsForHabitAndCategory(
                userId,
                id,
                updatedHabit.categoryId,
                updatedHabit.start_date
            );
        }

        return updatedHabit;
    }

    async delete(userId: string, id: string): Promise<void> {
        const habit = await this.repository.findById(id);

        if (!habit) {
            throw new NotFoundError("Habit not found");
        }

        if (habit.userId !== userId) {
            throw new NotFoundError(`Habit ${id} could not be found for user ${userId}`);
        }

        await this.repository.delete(id);
    }
}
