import { Habit } from "../models/Habit.js";
import { parseDayOfWeek } from "./util.js";

/**
 * Verifica se um hábito é elegível para a data alvo (considera end_date e period_type).
 */
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

/**
 * Filtra hábitos elegíveis para uma data.
 */
export function filterEligibleHabits<T extends { period_type: string; period_value?: string; end_date?: string }>(
    habits: T[],
    date: Date
): T[] {
    return habits.filter((habit) => isValidForTargetDate(habit as unknown as Habit, date));
}
