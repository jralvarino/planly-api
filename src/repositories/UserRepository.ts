import { GetCommand } from "@aws-sdk/lib-dynamodb";
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
}
