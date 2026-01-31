import { GetCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { User } from "../models/User.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";

export class UserRepository {
    async findByUser(userId: string): Promise<User | null> {
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.USER,
                Key: {
                    userId: userId,
                },
            })
        );

        return (result.Item as User) || null;
    }

    /** Returns all users (used by stats-midnight job). Paginates automatically. */
    async findAll(): Promise<User[]> {
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
        return items;
    }
}
