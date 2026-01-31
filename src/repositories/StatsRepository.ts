import { injectable } from "tsyringe";
import { GetCommand, PutCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Stats } from "../models/Stats.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";
import { logger } from "../utils/logger.js";

export interface StatsStreakFields {
    currentStreak: number;
    longestStreak: number;
    lastCompletedDate?: string;
    totalCompletions: number;
}

@injectable()
export class StatsRepository {
    async create(stats: Stats): Promise<void> {
        logger.debug("DynamoDB put", { table: DYNAMO_TABLES.STATS, key: { PK: stats.PK, SK: stats.SK }, scope: stats.scope });
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.STATS,
                Item: stats,
            })
        );
    }

    async updateStreakFields(PK: string, SK: string, fields: StatsStreakFields): Promise<void> {
        logger.debug("DynamoDB update", { table: DYNAMO_TABLES.STATS, key: { PK, SK } });
        const now = new Date().toISOString();

        await ddb.send(
            new UpdateCommand({
                TableName: DYNAMO_TABLES.STATS,
                Key: { PK, SK },
                UpdateExpression:
                    "SET #currentStreak = :currentStreak, #longestStreak = :longestStreak, #lastCompletedDate = :lastCompletedDate, #totalCompletions = :totalCompletions, #updatedAt = :updatedAt",
                ExpressionAttributeNames: {
                    "#currentStreak": "currentStreak",
                    "#longestStreak": "longestStreak",
                    "#lastCompletedDate": "lastCompletedDate",
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
        logger.debug("DynamoDB get", { table: DYNAMO_TABLES.STATS, key: { PK, SK } });
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.STATS,
                Key: { PK, SK },
            })
        );
        logger.debug("DynamoDB get result", { table: DYNAMO_TABLES.STATS, PK, SK, found: !!result.Item });
        return (result.Item as Stats) || null;
    }
}
