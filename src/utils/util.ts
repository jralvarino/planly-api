/** Fuso horário fixo: São Paulo (UTC-3). */
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

/** Formata uma data em YYYY-MM-DD no fuso São Paulo (UTC-3). */
function formatDateInSaoPaulo(d: Date): string {
    return d.toLocaleDateString("en-CA", { timeZone: TIMEZONE });
}

/** Retorna a data de hoje em São Paulo (UTC-3) em YYYY-MM-DD. */
export function todayISO(): string {
    return formatDateInSaoPaulo(new Date());
}

/** Soma delta dias à data (interpretada como dia em São Paulo) e retorna YYYY-MM-DD. */
export function addDays(dateStr: string, delta: number): string {
    const [y, m, d] = dateStr.split("-").map(Number);
    // Meia-noite em São Paulo (UTC-3) = 03:00 UTC
    const date = new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
    date.setUTCDate(date.getUTCDate() + delta);
    return formatDateInSaoPaulo(date);
}
