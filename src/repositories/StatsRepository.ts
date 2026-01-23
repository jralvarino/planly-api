import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Stats } from "../models/Stats.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";

export class StatsRepository {
    async create(stats: Stats): Promise<void> {
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.STATS,
                Item: stats,
            })
        );
    }
}
