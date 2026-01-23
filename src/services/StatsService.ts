import { StatsRepository } from "../repositories/StatsRepository.js";
import { Stats, StatsScope } from "../models/Stats.js";

export class StatsService {
    private repository = new StatsRepository();

    async createStats(
        userId: string,
        habitId: string,
        categoryId: string
    ): Promise<Stats[]> {
        const now = new Date().toISOString();
        const scopes: StatsScope[] = ["HABIT", "CATEGORY", "USER"];

        const statsPromises = scopes.map(async (scope) => {
            const stats: Stats = {
                PK: this.generatePK(userId),
                SK: this.generateSK(scope, habitId, categoryId),
                habitId,
                userId,
                categoryId,
                scope,
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
                createdAt: now,
                updatedAt: now,
            };

            await this.repository.create(stats);
            return stats;
        });

        return await Promise.all(statsPromises);
    }

    private generatePK(userId: string): string {
        return `USER#${userId}`;
    }

    private generateSK(scope: StatsScope, habitId: string, categoryId: string): string {
        switch (scope) {
            case "HABIT":
                return `STATS#HABIT#${habitId}`;
            case "CATEGORY":
                return `STATS#CATEGORY#${categoryId}`;
            case "USER":
                return `STATS#USER`;
            default:
                throw new Error(`Invalid scope: ${scope}`);
        }
    }
}
