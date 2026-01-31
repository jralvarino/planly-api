import { injectable } from "tsyringe";
import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { User } from "../models/User.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";
import { logger } from "../utils/logger.js";

@injectable()
export class UserRepository {
    async findByUser(userId: string): Promise<User | null> {
        logger.debug("DynamoDB get", { table: DYNAMO_TABLES.USER, key: { userId } });
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.USER,
                Key: { userId },
            })
        );
        logger.debug("DynamoDB get result", { table: DYNAMO_TABLES.USER, userId, found: !!result.Item });
        return (result.Item as User) || null;
    }

    /** Returns all users (used by stats-midnight job). Paginates automatically. */
    async findAll(): Promise<User[]> {
        logger.debug("DynamoDB scan", { table: DYNAMO_TABLES.USER });
        const items: User[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
            const result = await ddb.send(
                new ScanCommand({
                    TableName: DYNAMO_TABLES.USER,
                    ExclusiveStartKey: lastKey,
                })
            );
            items.push(...((result.Items as User[]) || []));
            lastKey = result.LastEvaluatedKey;
        } while (lastKey);
        logger.debug("DynamoDB scan result", { table: DYNAMO_TABLES.USER, totalCount: items.length });
        return items;
    }
}
