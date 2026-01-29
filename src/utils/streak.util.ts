/**
 * Resultado do cálculo de streak a partir de dias completos.
 */
export interface StreakResult {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate?: string;
    lastStreakStartDate?: string;
}

/**
 * Calcula currentStreak, longestStreak, lastCompletedDate e lastStreakStartDate
 * a partir de uma lista de datas em ordem cronológica e um Set (ou mapa) de datas "completas".
 * currentStreak = maior sequência de dias completos terminando em today.
 *
 * @param datesSorted - Datas em ordem crescente (ex.: ['2025-01-01', '2025-01-02', ...])
 * @param completedDates - Set de datas que estão completas (ex.: '2025-01-01')
 * @param today - Data de "hoje" no formato YYYY-MM-DD (fim da janela para currentStreak)
 */
export function computeStreakFromDailyCompletion(
    datesSorted: string[],
    completedDates: Set<string>,
    today: string
): StreakResult {
    if (datesSorted.length === 0) {
        return { currentStreak: 0, longestStreak: 0 };
    }

    let longestStreak = 0;
    let currentRun = 0;
    let lastCompletedDate: string | undefined;
    let currentStreak = 0;
    let lastStreakStartDate: string | undefined;

    for (const d of datesSorted) {
        if (completedDates.has(d)) {
            currentRun++;
            lastCompletedDate = d;
        } else {
            longestStreak = Math.max(longestStreak, currentRun);
            currentRun = 0;
        }
    }
    longestStreak = Math.max(longestStreak, currentRun);

    // Current streak: consecutive completed days ending at today (or last completed day before today)
    if (completedDates.has(today)) {
        // Today is completed: calculate streak ending at today
        let i = datesSorted.indexOf(today);
        if (i === -1) {
            currentStreak = 1;
            lastStreakStartDate = today;
        } else {
            let count = 0;
            while (i >= 0 && completedDates.has(datesSorted[i])) {
                count++;
                lastStreakStartDate = datesSorted[i];
                i--;
            }
            currentStreak = count;
        }
    } else if (lastCompletedDate) {
        // Today is not completed: calculate streak ending at lastCompletedDate
        let i = datesSorted.indexOf(lastCompletedDate);
        if (i !== -1) {
            let count = 0;
            while (i >= 0 && completedDates.has(datesSorted[i])) {
                count++;
                lastStreakStartDate = datesSorted[i];
                i--;
            }
            currentStreak = count;
        }
    }

    return {
        currentStreak,
        longestStreak,
        lastCompletedDate,
        lastStreakStartDate,
    };
}

/**
 * Gera array de datas no intervalo [startDate, endDate] (inclusive), formato YYYY-MM-DD.
 */
export function getDateRange(startDate: string, endDate: string): string[] {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dates: string[] = [];
    const current = new Date(start);
    while (current <= end) {
        dates.push(current.toISOString().split("T")[0]);
        current.setDate(current.getDate() + 1);
    }
    return dates;
}
