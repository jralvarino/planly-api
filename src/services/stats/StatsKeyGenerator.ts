import { StatsScope } from "../../models/Stats.js";
import { Habit } from "../../models/Habit.js";
import { todayISO } from "../../utils/util.js";
import { BadRequestError } from "../../errors/PlanlyError.js";

export function generatePK(userId: string): string {
    return `USER#${userId}`;
}

export function generateSK(scope: StatsScope, habitId: string, categoryId: string): string {
    switch (scope) {
        case "HABIT":
            return `STATS#HABIT#${habitId}`;
        case "CATEGORY":
            return `STATS#CATEGORY#${categoryId}`;
        case "USER":
            return `STATS#USER`;
        default:
            throw new BadRequestError(`Invalid scope: ${scope}`);
    }
}

export function getEndDate(habit: Habit): string {
    let endDate = habit.end_date;
    if (!endDate) {
        endDate = todayISO();
    }
    const today = todayISO();
    return today >= endDate ? today : endDate;
}
