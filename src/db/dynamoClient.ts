import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import { logger } from "../utils/logger.js";

const dynamoConfig: { region: string; endpoint?: string; credentials?: { accessKeyId: string; secretAccessKey: string } } = {
    region: process.env.AWS_REGION || "us-east-1",
};

const isLocal =
    !process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "development" ||
    process.env.AWS_SAM_LOCAL === "true";

let dynamoEndpoint = process.env.DYNAMODB_ENDPOINT;

if (!dynamoEndpoint && isLocal) {
    dynamoEndpoint = "http://dynamodb:8000";
}

if (dynamoEndpoint) {
    dynamoConfig.endpoint = dynamoEndpoint;
    dynamoConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    };
    logger.info("DynamoDB client: using local endpoint", { endpoint: dynamoEndpoint });
} else {
    logger.info("DynamoDB client: using AWS", { region: dynamoConfig.region });
}

const client = new DynamoDBClient(dynamoConfig);

export const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
    },
});
