import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const dynamoConfig: any = {
    region: process.env.AWS_REGION || "us-east-1",
};

// Detectar se está rodando localmente (não em produção na AWS)
const isLocal =
    !process.env.AWS_LAMBDA_FUNCTION_NAME ||
    process.env.NODE_ENV === "development" ||
    process.env.AWS_SAM_LOCAL === "true";

// Determinar o endpoint do DynamoDB
// Prioridade:
// 1. Variável de ambiente DYNAMODB_ENDPOINT (definida explicitamente)
// 2. Se SAM Local: usar nome do container do docker-compose
// 3. Se local (fora Docker): usar localhost
let dynamoEndpoint = process.env.DYNAMODB_ENDPOINT;

// Se não foi definido explicitamente e está rodando localmente, usar padrão
if (!dynamoEndpoint && isLocal) {
    // SAM Local: usar o nome do container do docker-compose (dynamodb-local)
    dynamoEndpoint = "http://dynamodb:8000";
}

// Se estiver rodando localmente com DynamoDB Local
if (dynamoEndpoint) {
    dynamoConfig.endpoint = dynamoEndpoint;
    dynamoConfig.credentials = {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "local",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "local",
    };

    console.log(`🔗 Conectando ao DynamoDB Local em: ${dynamoEndpoint}`);
} else {
    console.log(`☁️  Conectando ao DynamoDB na AWS (região: ${dynamoConfig.region})`);
}

const client = new DynamoDBClient(dynamoConfig);

export const ddb = DynamoDBDocumentClient.from(client, {
    marshallOptions: {
        removeUndefinedValues: true,
    },
});
