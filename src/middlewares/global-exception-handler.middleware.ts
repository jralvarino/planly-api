import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ZodError } from "zod";
import { PlanlyError } from "../errors/PlanlyError.js";
import { logger } from "../utils/logger.js";

interface ErrorResponse {
    statusCode: number;
    body: {
        errorType: string;
        message: string;
        details?: unknown;
        statusCode: number;
    };
}

export const globalExceptionHandler = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    return {
        onError: async (request) => {
            const error = request.error as Error & { cause?: unknown; statusCode?: number; errorType?: string; details?: unknown };

            let errorResponse: ErrorResponse;

            if (error instanceof ZodError) {
                const formattedErrors = error.issues.map((err) => ({
                    field: err.path.map(String).join(".") || "field",
                    message: err.message,
                }));

                errorResponse = {
                    statusCode: 400,
                    body: {
                        errorType: "VALIDATION_ERROR",
                        message: "Invalid request data",
                        details: formattedErrors,
                        statusCode: 400,
                    },
                };

                logger.warn("Validation error", { errorType: "VALIDATION_ERROR", details: formattedErrors });
            } else if (error instanceof PlanlyError) {
                // Custom Error
                const statusCode = error.statusCode || error?.statusCode || 500;
                const errorType = error.errorType || error?.errorType || "INTERNAL_SERVER_ERROR";
                const message = error.message || error?.message || "An error occurred";
                const details = error.details || error?.details;

                errorResponse = {
                    statusCode,
                    body: {
                        errorType,
                        message,
                        details,
                        statusCode,
                    },
                };

                if (statusCode >= 500) {
                    logger.error("Application error", { errorType, errorMessage: message, details, statusCode });
                } else {
                    logger.warn("Application error", { errorType, errorMessage: message, details, statusCode });
                }
            } else {
                // Generic Error
                const message = error?.message || "An internal server error occurred";
                const statusCode = error?.statusCode || 500;
                errorResponse = {
                    statusCode,
                    body: {
                        errorType: "INTERNAL_SERVER_ERROR",
                        message: "An error occurred while processing your request",
                        details: {
                            name: error?.name,
                            stack: error?.stack,
                        },
                        statusCode,
                    },
                };

                logger.error("Unhandled error", { errorType: "INTERNAL_SERVER_ERROR", errorMessage: message, error });
            }

            request.response = {
                statusCode: errorResponse.statusCode,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(errorResponse.body),
            };

            logger.info("Response sent", { statusCode: errorResponse.statusCode, body: errorResponse.body });

            return;
        },
    };
};
