import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import type { z } from "zod";
import { ValidationError } from "../errors/PlanlyError.js";
import { logger } from "../utils/logger.js";

export const zodValidator = <T extends z.ZodType>(
    schema: T
): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    return {
        before: async (request) => {
            const event = request.event;
            const data = {
                body: event.body,
                pathParameters: event.pathParameters ?? {},
                queryStringParameters: event.queryStringParameters ?? {},
            };

            const result = schema.safeParse(data);

            if (!result.success) {
                const formattedErrors = result.error.issues.map((err) => ({
                    field: err.path.map(String).join(".") || "field",
                    message: err.message,
                }));
                logger.debug("Validation failed", { path: event.path ?? event.resource, issues: formattedErrors });
                throw new ValidationError("Invalid request data", formattedErrors);
            }

            (event as APIGatewayProxyEvent & { validated: z.infer<T> }).validated = result.data;
        },
    };
};
