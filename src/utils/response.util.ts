import type { APIGatewayProxyResult } from "aws-lambda";

const createResponse = (
    body: any,
    statusCode: number = 200,
    headers?: Record<string, string>
): APIGatewayProxyResult => {
    return {
        statusCode,
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: JSON.stringify(body),
    };
};

/**
 * Cria uma resposta de sucesso (200)
 */
export const success = (body: any, headers?: Record<string, string>): APIGatewayProxyResult => {
    return createResponse(body, 200, headers);
};

/**
 * Cria uma resposta de criação (201)
 */
export const created = (body: any, headers?: Record<string, string>): APIGatewayProxyResult => {
    return createResponse(body, 201, headers);
};

/**
 * Cria uma resposta sem conteúdo (204)
 */
export const noContent = (headers?: Record<string, string>): APIGatewayProxyResult => {
    return {
        statusCode: 204,
        headers: {
            "Content-Type": "application/json",
            ...headers,
        },
        body: "",
    };
};
