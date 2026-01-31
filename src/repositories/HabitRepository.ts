import { injectable } from "tsyringe";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, ScanCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Habit } from "../models/Habit.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";
import { logger } from "../utils/logger.js";

@injectable()
export class HabitRepository {
    async create(habit: Habit): Promise<void> {
        logger.debug("DynamoDB put", { table: DYNAMO_TABLES.HABIT, key: { id: habit.id } });
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.HABIT,
                Item: habit,
                ConditionExpression: "attribute_not_exists(id)",
            })
        );
    }

    async update(habit: Habit): Promise<void> {
        logger.debug("DynamoDB put (update)", { table: DYNAMO_TABLES.HABIT, key: { id: habit.id } });
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.HABIT,
                Item: {
                    ...habit,
                    updatedAt: new Date().toISOString(),
                },
            })
        );
    }

    async findById(id: string): Promise<Habit | null> {
        logger.debug("DynamoDB get", { table: DYNAMO_TABLES.HABIT, key: { id } });
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.HABIT,
                Key: { id },
            })
        );
        logger.debug("DynamoDB get result", { table: DYNAMO_TABLES.HABIT, key: { id }, found: !!result.Item });
        return (result.Item as Habit) || null;
    }

    async findAllByUserId(userId: string): Promise<Habit[]> {
        logger.debug("DynamoDB query", { table: DYNAMO_TABLES.HABIT, index: "userId-index", userId });
        const result = await ddb.send(
            new QueryCommand({
                TableName: DYNAMO_TABLES.HABIT,
                IndexName: "userId-index",
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: {
                    ":userId": userId,
                },
                ScanIndexForward: false,
            })
        );
        logger.debug("DynamoDB query result", { table: DYNAMO_TABLES.HABIT, userId, count: result.Items?.length ?? 0 });
        return (result.Items as Habit[]) || [];
    }

    async findAllByDate(userId: string, date: string): Promise<Habit[]> {
        logger.debug("DynamoDB query", { table: DYNAMO_TABLES.HABIT, index: "userId-start_date-index", userId, date });
        const result = await ddb.send(
            new QueryCommand({
                TableName: DYNAMO_TABLES.HABIT,
                IndexName: "userId-start_date-index",
                KeyConditionExpression: "userId = :userId AND start_date <= :date",
                ExpressionAttributeValues: {
                    ":userId": userId,
                    ":date": date,
                },
            })
        );
        logger.debug("DynamoDB query result", { table: DYNAMO_TABLES.HABIT, userId, date, count: result.Items?.length ?? 0 });
        return (result.Items as Habit[]) || [];
    }

    async delete(id: string): Promise<void> {
        logger.debug("DynamoDB delete", { table: DYNAMO_TABLES.HABIT, key: { id } });
        await ddb.send(
            new DeleteCommand({
                TableName: DYNAMO_TABLES.HABIT,
                Key: { id },
            })
        );
    }

    /** Returns all habits (used by stats-midnight job). Paginates automatically. */
    async findAll(): Promise<Habit[]> {
        logger.debug("DynamoDB scan", { table: DYNAMO_TABLES.HABIT });
        const items: Habit[] = [];
        let lastKey: Record<string, unknown> | undefined;
        do {
            const result = await ddb.send(
                new ScanCommand({
                    TableName: DYNAMO_TABLES.HABIT,
                    ExclusiveStartKey: lastKey,
                })
            );
            items.push(...((result.Items as Habit[]) || []));
            lastKey = result.LastEvaluatedKey;
        } while (lastKey);
        logger.debug("DynamoDB scan result", { table: DYNAMO_TABLES.HABIT, totalCount: items.length });
        return items;
    }
}
