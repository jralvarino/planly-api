import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PlanlyError } from "../errors/PlanlyError.js";

interface ErrorResponse {
    statusCode: number;
    body: {
        errorType: string;
        message: string;
        details?: any;
        statusCode: number;
    };
}

export const globalExceptionHandler = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    return {
        onError: async (request) => {
            const error = request.error as any;

            let errorResponse: ErrorResponse;

            if (error?.cause?.package === "@middy/validator" && error?.cause?.data) {
                //Validation error
                const validationErrors = error.cause.data as Array<{
                    instancePath?: string;
                    schemaPath?: string;
                    keyword?: string;
                    params?: any;
                    message?: string;
                }>;

                const formattedErrors = validationErrors.map((err) => {
                    let field = "campo";
                    if (err.instancePath) {
                        const parts = err.instancePath.split("/").filter((p) => p);
                        field = parts[parts.length - 1] || "campo";
                    } else if (err.params?.missingProperty) {
                        field = err.params.missingProperty;
                    } else if (err.params?.additionalProperty) {
                        field = err.params.additionalProperty;
                    }

                    let message = err.message || "Erro de validação";

                    message = `Erro no campo '${field}': ${message}`;

                    return {
                        field,
                        message,
                    };
                });

                errorResponse = {
                    statusCode: 400,
                    body: {
                        errorType: "VALIDATION_ERROR",
                        message: "Os dados fornecidos são inválidos",
                        details: formattedErrors,
                        statusCode: 400,
                    },
                };
            } else if (error instanceof PlanlyError) {
                //Custom Error
                const statusCode = error.statusCode || error?.statusCode || 500;
                const errorType = error.errorType || error?.errorType || "INTERNAL_SERVER_ERROR";
                const message = error.message || error?.message || "Ocorreu um erro";
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
            } else {
                //Generic Error
                const message = error?.message || "Ocorreu um erro interno do servidor";
                const statusCode = error?.statusCode || 500;
                errorResponse = {
                    statusCode,
                    body: {
                        errorType: "INTERNAL_SERVER_ERROR",
                        message: "Ocorreu um erro ao processar sua solicitação",
                        details: {
                            name: error?.name,
                            stack: error?.stack,
                        },
                        statusCode,
                    },
                };
            }

            request.response = {
                statusCode: errorResponse.statusCode,
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(errorResponse.body),
            };

            return;
        },
    };
};
