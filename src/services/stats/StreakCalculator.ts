/**
 * Cálculo puro de streak a partir de datas agendadas e datas completadas.
 * Sem I/O; fácil de testar isoladamente.
 */
export interface StreakResult {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate: string | undefined;
}

/**
 * Percorre as datas agendadas em ordem e retorna currentStreak, longestStreak e lastCompletedDate.
 * currentStreak = run no fim da lista (trailing run); se houver gap antes do fim, streak = 0.
 * Exceção: se o último dia agendado for `today` e ainda não estiver completo e o último dia
 * completado for o dia agendado imediatamente antes de hoje, o streak mostrado é o run anterior
 * (usuário tem até 00:00 para completar hoje). Assim funciona tanto para "todo dia" (user/category)
 * quanto para dias específicos (ex.: Seg/Qua/Sex).
 */
export function computeFullStreakStats(
    scheduledAsc: string[],
    completedDates: Set<string>,
    today?: string
): StreakResult {
    let longestStreak = 0;
    let run = 0;
    let lastCompletedDate: string | undefined;
    let lastRunLengthWhenGap = 0;

    for (const date of scheduledAsc) {
        if (completedDates.has(date)) {
            run++;
            longestStreak = Math.max(longestStreak, run);
            lastCompletedDate = date;
        } else {
            if (run > 0) lastRunLengthWhenGap = run;
            run = 0;
        }
    }

    const lastScheduled = scheduledAsc[scheduledAsc.length - 1];
    const pendingToday = today != null && lastScheduled === today && !completedDates.has(today);
    const prevScheduledDate = scheduledAsc.length >= 2 ? scheduledAsc[scheduledAsc.length - 2] : undefined;
    const onlyTodayPending = pendingToday && prevScheduledDate != null && lastCompletedDate === prevScheduledDate;
    const currentStreak = onlyTodayPending ? lastRunLengthWhenGap : run;
    return { currentStreak, longestStreak, lastCompletedDate };
}

/**
 * Calcula o streak e a última data completada considerando só datas agendadas até `upToDateInclusive`.
 */
export function computeStreakUpTo(
    scheduledAsc: string[],
    completedDates: Set<string>,
    upToDateInclusive: string
): { streak: number; lastCompletedDate: string | undefined } {
    const upTo = scheduledAsc.filter((d) => d <= upToDateInclusive);
    const { currentStreak, lastCompletedDate } = computeFullStreakStats(upTo, completedDates);
    return { streak: currentStreak, lastCompletedDate };
}
