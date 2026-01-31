import { injectable } from "tsyringe";
import { DeleteCommand, GetCommand, PutCommand, QueryCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { ddb } from "../db/dynamoClient.js";
import { Category } from "../models/Category.js";
import { DYNAMO_TABLES } from "../db/dynamodb.tables.js";
import { logger } from "../utils/logger.js";

@injectable()
export class CategoryRepository {
    async create(category: Category): Promise<void> {
        logger.debug("DynamoDB put", { table: DYNAMO_TABLES.CATEGORY, key: { id: category.id } });
        await ddb.send(
            new PutCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                Item: category,
                ConditionExpression: "attribute_not_exists(id)",
            })
        );
    }

    async update(category: Category): Promise<void> {
        logger.debug("DynamoDB put (update)", { table: DYNAMO_TABLES.CATEGORY, key: { id: category.id } });
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
        logger.debug("DynamoDB get", { table: DYNAMO_TABLES.CATEGORY, key: { id } });
        const result = await ddb.send(
            new GetCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                Key: { id },
            })
        );
        const found = !!result.Item;
        logger.debug("DynamoDB get result", { table: DYNAMO_TABLES.CATEGORY, key: { id }, found });
        return (result.Item as Category) || null;
    }

    async findByName(userId: string, name: string): Promise<Category | null> {
        logger.debug("DynamoDB query", { table: DYNAMO_TABLES.CATEGORY, index: "userId-index", userId });
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

        const count = result.Items?.length ?? 0;
        logger.debug("DynamoDB query result", { table: DYNAMO_TABLES.CATEGORY, userId, count });
        if (!result.Items || result.Items.length === 0) {
            return null;
        }
        return result.Items[0] as Category;
    }

    async findAllByUserId(userId: string): Promise<Category[]> {
        logger.debug("DynamoDB query", { table: DYNAMO_TABLES.CATEGORY, index: "userId-index", userId });
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
        logger.debug("DynamoDB query result", { table: DYNAMO_TABLES.CATEGORY, userId, count: result.Items?.length ?? 0 });
        return (result.Items as Category[]) || [];
    }

    async delete(id: string): Promise<void> {
        logger.debug("DynamoDB delete", { table: DYNAMO_TABLES.CATEGORY, key: { id } });
        await ddb.send(
            new DeleteCommand({
                TableName: DYNAMO_TABLES.CATEGORY,
                Key: { id },
            })
        );
    }
}
