const TIMEZONE = "America/Sao_Paulo";

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

function formatDateInSaoPaulo(d: Date): string {
    return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

export function todayISO(): string {
    return formatDateInSaoPaulo(new Date());
}

export function addDays(dateStr: string, delta: number): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
    date.setUTCDate(date.getUTCDate() + delta);
    return formatDateInSaoPaulo(date);
}
