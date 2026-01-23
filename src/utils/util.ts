const DAY_OF_WEEK_MAP: Record<string, number> = {
    SUN: 0,
    MON: 1,
    TUE: 2,
    WED: 3,
    THU: 4,
    FRI: 5,
    SAT: 6,
};

export function parseDayOfWeek(value: string): number | null {
    const trimmed = value.trim().toUpperCase();

    if (DAY_OF_WEEK_MAP[trimmed] !== undefined) {
        return DAY_OF_WEEK_MAP[trimmed];
    }

    return null;
}
