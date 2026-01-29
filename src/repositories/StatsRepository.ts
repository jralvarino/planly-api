import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Stats, StatsScope } from "../models/Stats.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";

export interface StatsStreakFields {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate?: string;
    lastStreakStartDate?: string;
    totalCompletions: number;
}

export class StatsRepository {
    async create(stats: Stats): Promise<void> {
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.STATS,
                Item: stats,
            })
        );
    }

    async get(userId: string, scope: StatsScope, habitId?: string, categoryId?: string): Promise<Stats | null> {
        const PK = this.buildPK(userId);
        const SK = this.buildSK(scope, habitId, categoryId);
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.STATS,
                Key: { PK, SK },
            })
        );
        return (result.Item as Stats) || null;
    }

    async update(stats: Stats): Promise<void> {
        const updated = {
            ...stats,
            updatedAt: new Date().toISOString(),
        };
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.STATS,
                Item: updated,
            })
        );
    }

    async updateStreakFields(
        userId: string,
        scope: StatsScope,
        fields: StatsStreakFields,
        habitId?: string,
        categoryId?: string
    ): Promise<void> {
        const PK = this.buildPK(userId);
        const SK = this.buildSK(scope, habitId, categoryId);
        const now = new Date().toISOString();

        await ddb.send(
            new UpdateCommand({
                TableName: DYNAMO_TABLES.STATS,
                Key: { PK, SK },
                UpdateExpression:
                    "SET #currentStreak = :currentStreak, #longestStreak = :longestStreak, #lastCompletedDate = :lastCompletedDate, #lastStreakStartDate = :lastStreakStartDate, #totalCompletions = :totalCompletions, #updatedAt = :updatedAt",
                ExpressionAttributeNames: {
                    "#currentStreak": "currentStreak",
                    "#longestStreak": "longestStreak",
                    "#lastCompletedDate": "lastCompletedDate",
                    "#lastStreakStartDate": "lastStreakStartDate",
                    "#totalCompletions": "totalCompletions",
                    "#updatedAt": "updatedAt",
                },
                ExpressionAttributeValues: {
                    ":currentStreak": fields.currentStreak,
                    ":longestStreak": fields.longestStreak,
                    ":lastCompletedDate": fields.lastCompletedDate ?? null,
                    ":lastStreakStartDate": fields.lastStreakStartDate ?? null,
                    ":totalCompletions": fields.totalCompletions,
                    ":updatedAt": now,
                },
            })
        );
    }

    private buildPK(userId: string): string {
        return `USER#${userId}`;
    }

    private buildSK(scope: StatsScope, habitId?: string, categoryId?: string): string {
        switch (scope) {
            case "HABIT":
                return `STATS#HABIT#${habitId ?? ""}`;
            case "CATEGORY":
                return `STATS#CATEGORY#${categoryId ?? ""}`;
            case "USER":
                return "STATS#USER";
            default:
                throw new Error(`Invalid scope: ${scope}`);
        }
    }
}
