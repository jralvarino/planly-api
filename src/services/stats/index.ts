/**
 * Stats module: streak calculation, key generation, completed-dates helpers,
 * and updaters for HABIT, CATEGORY, and USER scopes.
 * StatsService (facade) orchestrates these; consumers import from ../StatsService.js.
 */

export { computeFullStreakStats, computeStreakUpTo } from "./StreakCalculator.js";
export type { StreakResult } from "./StreakCalculator.js";
export { generatePK, generateSK, getEndDate } from "./StatsKeyGenerator.js";
export { datesRange } from "../../utils/util.js";
export {
    getCompletedDatesFromTodoList,
    getCompletedCategoryDatesFromTodoList,
    getCompletedUserDatesFromTodoList,
} from "./completedDates.js";
export { HabitStatsUpdater } from "./HabitStatsUpdater.js";
export type { HabitStatsUpdaterParams, UpdateHabitStatsIncrementalParams } from "./HabitStatsUpdater.js";
export { CategoryStatsUpdater } from "./CategoryStatsUpdater.js";
export type { CategoryStatsUpdaterParams, UpdateCategoryStatsIncrementalParams } from "./CategoryStatsUpdater.js";
export { UserStatsUpdater } from "./UserStatsUpdater.js";
export type { UserStatsUpdaterParams, UpdateUserStatsIncrementalParams } from "./UserStatsUpdater.js";
export { StatsDashboardAggregator } from "./StatsDashboardAggregator.js";
export type { StatsDashboardData, StatsDashboardAggregatorDeps } from "./StatsDashboardAggregator.js";
