import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { logger } from "../utils/logger.js";

export const requestLoggingMiddleware = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    return {
        before: async (request) => {
            const event = request.event;
            const method = event.httpMethod ?? "UNKNOWN";
            const path = event.path ?? event.resource ?? "";
            const pathParams = event.pathParameters ?? undefined;
            const queryParams = event.queryStringParameters ?? undefined;
            const body = event.body ?? undefined;

            logger.info("Request received", {
                method,
                path,
                ...(pathParams && Object.keys(pathParams).length > 0 && { pathParameters: pathParams }),
                ...(queryParams && Object.keys(queryParams).length > 0 && { queryStringParameters: queryParams }),
                ...(body !== undefined && body !== null && body !== "" && { body }),
            });
        },
        after: async (request) => {
            const response = request.response;
            const statusCode = response?.statusCode ?? "N/A";
            const body = response?.body;
            let responseBody = body;
            if (typeof body === "string" && body.length > 0) {
                try {
                    responseBody = JSON.parse(body);
                } catch {
                    responseBody = body;
                }
            }
            logger.info("Response sent", {
                statusCode,
                ...(responseBody !== undefined && responseBody !== "" && { body: responseBody }),
            });
        },
    };
};
