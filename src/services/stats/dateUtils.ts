import { addDays } from "../../utils/util.js";

/**
 * Retorna array de datas (YYYY-MM-DD) de startDate até endDate inclusive.
 */
export function datesRange(startDate: string, endDate: string): string[] {
    const dates: string[] = [];
    let d = startDate;
    while (d <= endDate) {
        dates.push(d);
        d = addDays(d, 1);
    }
    return dates;
}
