import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Category } from "../models/Category.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";

export class CategoryRepository {
    async create(category: Category): Promise<void> {
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                Item: category,
                ConditionExpression: "attribute_not_exists(id)",
            })
        );
    }

    async update(category: Category): Promise<void> {
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                Item: {
                    ...category,
                    updatedAt: new Date().toISOString(),
                },
            })
        );
    }

    async findById(id: string): Promise<Category | null> {
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                Key: {
                    id,
                },
            })
        );

        return (result.Item as Category) || null;
    }

    async findByName(userId: string, name: string): Promise<Category | null> {
        const result = await ddb.send(
            new QueryCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                IndexName: "userId-index",
                KeyConditionExpression: "userId = :userId",
                FilterExpression: "#name = :name",
                ExpressionAttributeNames: {
                    "#name": "name",
                },
                ExpressionAttributeValues: {
                    ":userId": userId,
                    ":name": name,
                },
            })
        );

        if (!result.Items || result.Items.length === 0) {
            return null;
        }

        return result.Items[0] as Category;
    }

    async findAllByUserId(userId: string): Promise<Category[]> {
        const result = await ddb.send(
            new QueryCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                IndexName: "userId-index",
                KeyConditionExpression: "userId = :userId",
                ExpressionAttributeValues: {
                    ":userId": userId,
                },
                ScanIndexForward: false,
            })
        );

        return (result.Items as Category[]) || [];
    }

    async delete(id: string): Promise<void> {
        await ddb.send(
            new DeleteCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                Key: { id },
            })
        );
    }
}
