import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Stats } from "../models/Stats.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";

export interface StatsStreakFields {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate?: string;
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

    async updateStreakFields(PK: string, SK: string, fields: StatsStreakFields): Promise<void> {
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
                    ":totalCompletions": fields.totalCompletions,
                    ":updatedAt": now,
                },
            })
        );
    }

    async get(PK: string, SK: string): Promise<Stats | null> {
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.STATS,
                Key: { PK, SK },
            })
        );
        return (result.Item as Stats) || null;
    }
}
