import { DeleteCommand, GetCommand, PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Habit } from "../models/Habit.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";

export class HabitRepository {
    async create(habit: Habit): Promise<void> {
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.HABIT,
                Item: habit,
                ConditionExpression: "attribute_not_exists(id)",
            })
        );
    }

    async update(habit: Habit): Promise<void> {
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
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.HABIT,
                Key: {
                    id,
                },
            })
        );

        return (result.Item as Habit) || null;
    }

    async findAllByUserId(userId: string): Promise<Habit[]> {
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

        return (result.Items as Habit[]) || [];
    }

    async findAllByDate(userId: string, date: string): Promise<Habit[]> {
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

        return (result.Items as Habit[]) || [];
    }

    async delete(id: string): Promise<void> {
        await ddb.send(
            new DeleteCommand({
                TableName: DYNAMO_TABLES.HABIT,
                Key: { id },
            })
        );
    }
}
