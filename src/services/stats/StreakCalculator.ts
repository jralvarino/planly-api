/**
 * Pure streak calculation from scheduled dates and completed dates.
 * No I/O; easy to test in isolation.
 */
export interface StreakResult {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate: string | undefined;
}

/**
 * Iterates scheduled dates in order and returns currentStreak, longestStreak and lastCompletedDate.
 * currentStreak = trailing run at the end of the list; if there is a gap before the end, streak = 0.
 * Exception: if the last scheduled day is `today` and not yet complete and the last completed day
 * is the scheduled day immediately before today, the displayed streak is the previous run
 * (user has until 00:00 to complete today). Works for both "every day" (user/category)
 * and specific days (e.g. Mon/Wed/Fri).
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
 * Calculates streak and last completed date considering only scheduled dates up to `upToDateInclusive`.
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
