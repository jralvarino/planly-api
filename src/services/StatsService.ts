import { injectable } from "tsyringe";
import { StatsRepository } from "../repositories/StatsRepository.js";
import { Stats, StatsScope } from "../models/Stats.js";
import { logger } from "../utils/logger.js";
import { InternalServerError } from "../errors/PlanlyError.js";
import { todayISO } from "../utils/util.js";
import { HabitStatsUpdater } from "./stats/HabitStatsUpdater.js";
import { CategoryStatsUpdater } from "./stats/CategoryStatsUpdater.js";
import { UserStatsUpdater } from "./stats/UserStatsUpdater.js";
import {
    StatsDashboardAggregator,
    type StatsDashboardData,
} from "./stats/StatsDashboardAggregator.js";
import { generatePK, generateSK } from "./stats/StatsKeyGenerator.js";
import { HabitService } from "./HabitService.js";
import { TodoService } from "./TodoService.js";
import { TodoRepository } from "../repositories/TodoRepository.js";
import { container } from "../container.js";

export type { StatsDashboardData } from "./stats/StatsDashboardAggregator.js";

export interface UpdateStatsOnStatusChangeParams {
    userId: string;
    habitId: string;
    categoryId: string;
    date: string;
    newStatus: string;
    previousStatus?: string;
}

export interface GetHabitStatsParams {
    scope: StatsScope;
    userId: string;
    habitId: string;
    categoryId?: string;
}

@injectable()
export class StatsService {
    private _todoService: TodoService | null = null;

    constructor(
        private readonly repository: StatsRepository,
        private readonly todoRepository: TodoRepository,
        private readonly habitService: HabitService
    ) {}

    private get todoService(): TodoService {
        if (!this._todoService) {
            this._todoService = container.resolve(TodoService);
        }
        return this._todoService;
    }

    private get habitStatsUpdater(): HabitStatsUpdater {
        return new HabitStatsUpdater({
            repository: this.repository,
            todoRepository: this.todoRepository,
            habitService: this.habitService,
            getHabitStats: (params) => this.getHabitStats(params),
        });
    }

    private get categoryStatsUpdater(): CategoryStatsUpdater {
        return new CategoryStatsUpdater({
            repository: this.repository,
            todoRepository: this.todoRepository,
            habitService: this.habitService,
            getTodoListByDate: (userId, date) => this.todoService.getTodoListByDate(userId, date),
            getHabitStats: (params) => this.getHabitStats(params),
        });
    }

    private get userStatsUpdater(): UserStatsUpdater {
        return new UserStatsUpdater({
            repository: this.repository,
            todoRepository: this.todoRepository,
            habitService: this.habitService,
            getTodoListByDate: (userId, date) => this.todoService.getTodoListByDate(userId, date),
            getHabitStats: (params) => this.getHabitStats(params),
        });
    }

    private get dashboardAggregator(): StatsDashboardAggregator {
        return new StatsDashboardAggregator({
            repository: this.repository,
            todoRepository: this.todoRepository,
            habitService: this.habitService,
            getTodoListByDate: (userId, date, categoryId, habitId) =>
                this.todoService.getTodoListByDate(userId, date, categoryId, habitId),
        });
    }

    async createStats(userId: string, habitId: string, categoryId: string): Promise<Stats[]> {
        const now = new Date().toISOString();

        logger.info("Creating stats for habit", { userId, habitId, categoryId });

        // HABIT: always create (unique per habit)
        const habitStats: Stats = {
            PK: generatePK(userId),
            SK: generateSK("HABIT", habitId, categoryId),
            habitId,
            userId,
            categoryId,
            scope: "HABIT",
            currentStreak: 0,
            longestStreak: 0,
            totalCompletions: 0,
            createdAt: now,
            updatedAt: now,
        };
        await this.repository.create(habitStats);

        // CATEGORY and USER: create only if not exists (do not overwrite existing streak data)
        const categoryStats: Stats = {
            PK: generatePK(userId),
            SK: generateSK("CATEGORY", habitId, categoryId),
            habitId,
            userId,
            categoryId,
            scope: "CATEGORY",
            currentStreak: 0,
            longestStreak: 0,
            totalCompletions: 0,
            createdAt: now,
            updatedAt: now,
        };
        await this.repository.createIfNotExists(categoryStats);

        const userStats: Stats = {
            PK: generatePK(userId),
            SK: generateSK("USER", habitId, categoryId),
            habitId,
            userId,
            categoryId,
            scope: "USER",
            currentStreak: 0,
            longestStreak: 0,
            totalCompletions: 0,
            createdAt: now,
            updatedAt: now,
        };
        await this.repository.createIfNotExists(userStats);

        logger.debug("Stats created for habit", { userId, habitId, categoryId });
        return [habitStats, categoryStats, userStats];
    }

    async updateStatsOnTodoStatusChange(params: UpdateStatsOnStatusChangeParams): Promise<void> {
        try {
            const { userId, habitId, categoryId, date, newStatus, previousStatus } = params;

            if (newStatus === previousStatus) {
                logger.debug("Stats update skipped: no status change", {
                    userId,
                    habitId,
                    categoryId,
                    date,
                    newStatus,
                    previousStatus,
                });
                return;
            }

            const scopes = ["HABIT", "CATEGORY", "USER"] as const;
            const isToday = date === todayISO();

            logger.info("Updating stats on todo status change", {
                userId,
                habitId,
                categoryId,
                date,
                newStatus,
                previousStatus,
                mode: isToday ? "incremental" : "full_recalculate",
            });

            if (isToday) {
                const results = await Promise.allSettled([
                    this.habitStatsUpdater.updateIncremental({
                        userId,
                        habitId,
                        date,
                        newStatus,
                        previousStatus,
                    }),
                    this.categoryStatsUpdater.updateIncremental({
                        userId,
                        habitId,
                        categoryId,
                        date,
                    }),
                    this.userStatsUpdater.updateIncremental({ userId, habitId, date }),
                ]);

                this.throwIfStatsUpdatesFailed(results, scopes, {
                    userId,
                    habitId,
                    date,
                    categoryId,
                    mode: "incremental",
                });
            } else {
                const results = await Promise.allSettled([
                    this.habitStatsUpdater.recalculate(userId, habitId),
                    this.categoryStatsUpdater.recalculate(userId, categoryId),
                    this.userStatsUpdater.recalculate(userId),
                ]);

                this.throwIfStatsUpdatesFailed(results, scopes, {
                    userId,
                    habitId,
                    date,
                    categoryId,
                    mode: "full_recalculate",
                });
            }
        } catch (error) {
            if (error instanceof InternalServerError) {
                throw error;
            }
            logger.error("Error updating stats on todo status change", {
                userId: params.userId,
                habitId: params.habitId,
                categoryId: params.categoryId,
                date: params.date,
                newStatus: params.newStatus,
                previousStatus: params.previousStatus,
                error,
            });
            throw error;
        }
    }

    /**
     * Recalculates streaks for habit, category and user (e.g. after midnight when no TODO existed for yesterday).
     * Used by the stats-midnight Lambda job.
     */
    async recalculateStreaksAfterMidnight(userId: string, habitId: string, categoryId: string): Promise<void> {
        const scopes = ["HABIT", "CATEGORY", "USER"] as const;
        const results = await Promise.allSettled([
            this.habitStatsUpdater.recalculate(userId, habitId),
            this.categoryStatsUpdater.recalculate(userId, categoryId),
            this.userStatsUpdater.recalculate(userId),
        ]);
        this.throwIfStatsUpdatesFailed(results, scopes, {
            userId,
            habitId,
            date: "",
            categoryId,
            mode: "midnight_recalculate",
        });
    }

    /**
     * Recalculates all stats when a new habit is created and its start_date affects dates up to today.
     */
    async recalculateStatsOnHabitCreated(userId: string, habitId: string, categoryId: string): Promise<void> {
        const scopes = ["HABIT", "CATEGORY", "USER"] as const;
        const results = await Promise.allSettled([
            this.habitStatsUpdater.recalculate(userId, habitId),
            this.categoryStatsUpdater.recalculate(userId, categoryId),
            this.userStatsUpdater.recalculate(userId),
        ]);
        this.throwIfStatsUpdatesFailed(results, scopes, {
            userId,
            habitId,
            date: "",
            categoryId,
            mode: "habit_created",
        });
    }

    /**
     * Recalculates stats when a habit is edited and stats-affecting fields changed.
     */
    async recalculateStatsOnHabitEdited(
        userId: string,
        habitId: string,
        oldCategoryId: string,
        newCategoryId: string
    ): Promise<void> {
        const categoriesToRecalc = Array.from(new Set([oldCategoryId, newCategoryId].filter(Boolean)));
        const promises: Promise<void>[] = [
            this.habitStatsUpdater.recalculate(userId, habitId),
            this.userStatsUpdater.recalculate(userId),
            ...categoriesToRecalc.map((catId) => this.categoryStatsUpdater.recalculate(userId, catId)),
        ];

        const scopes = ["HABIT", "USER", ...categoriesToRecalc.map((c) => `CATEGORY#${c}`)];
        const results = await Promise.allSettled(promises);
        this.throwIfStatsUpdatesFailed(results, scopes, {
            userId,
            habitId,
            date: "",
            categoryId: newCategoryId,
            mode: "habit_edited",
        });
    }

    async getHabitStreak(userId: string, habitId: string): Promise<number> {
        const stats = await this.repository.get(generatePK(userId), generateSK("HABIT", habitId, ""));
        return stats?.currentStreak ?? 0;
    }

    async getGlobalStreak(userId: string): Promise<number> {
        const stats = await this.repository.get(generatePK(userId), generateSK("USER", "", ""));
        return stats?.currentStreak ?? 0;
    }

    async getDashboardData(
        userId: string,
        month: string,
        categoryId?: string,
        habitId?: string,
        selectedDate?: string
    ): Promise<StatsDashboardData> {
        return this.dashboardAggregator.getData(userId, month, categoryId, habitId, selectedDate);
    }

    async getHabitStats(params: GetHabitStatsParams): Promise<Stats> {
        const pk = generatePK(params.userId);
        const sk = generateSK(params.scope, params.habitId, params.categoryId || "");
        const stats = await this.repository.get(pk, sk);

        if (!stats) {
            logger.warn("Stats not found for getHabitStats", {
                userId: params.userId,
                scope: params.scope,
                habitId: params.habitId,
                categoryId: params.categoryId,
                pk,
                sk,
            });
            throw new Error(`Stats not found: ${params.scope} ${params.habitId}`);
        }

        return stats;
    }

    private throwIfStatsUpdatesFailed(
        results: PromiseSettledResult<void>[],
        scopes: readonly string[],
        context: { userId: string; habitId: string; date: string; categoryId?: string; mode?: string }
    ): void {
        const failed: string[] = [];
        const errors: Array<{ scope: string; reason: unknown }> = [];

        results.forEach((result, index) => {
            const scope = scopes[index];
            if (result.status === "rejected") {
                failed.push(scope);
                errors.push({ scope, reason: result.reason });
                logger.error("Stats update failed for scope", {
                    scope,
                    ...context,
                    error: result.reason,
                });
            }
        });

        if (failed.length > 0) {
            throw new InternalServerError("One or more stats updates failed", {
                failed,
                errors: errors.map((e) => ({
                    scope: e.scope,
                    message: e.reason instanceof Error ? e.reason.message : String(e.reason),
                })),
            });
        }
    }
}
