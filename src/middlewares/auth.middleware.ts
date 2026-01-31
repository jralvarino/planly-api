import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors/PlanlyError.js";
import { getJwtSecret } from "../utils/secretsManager.js";
import { logger } from "../utils/logger.js";

export interface AuthContext {
    userId: string;
    email?: string;
    [key: string]: unknown;
}

export interface PlanlyAuthorizer {
    userId: string;
    email?: string;
}

export function getUserId(event: APIGatewayProxyEvent): string {
    const authorizer = event.requestContext?.authorizer as PlanlyAuthorizer | undefined;
    const userId = authorizer?.userId;
    if (!userId) {
        throw new UnauthorizedError("Unauthorized: userId missing");
    }
    return userId;
}

export const authMiddleware = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    return {
        before: async (request) => {
            const authHeader = request.event.headers.Authorization || request.event.headers.authorization;

            if (!authHeader) {
                logger.warn("Auth failed: token missing");
                throw new UnauthorizedError("Unauthorized: Token missing");
            }

            const token = authHeader.replace("Bearer ", "").trim();

            if (!token) {
                logger.warn("Auth failed: token empty");
                throw new UnauthorizedError("Unauthorized: Token missing");
            }

            try {
                const jwtSecret = await getJwtSecret();
                const decoded = jwt.verify(token, jwtSecret) as PlanlyAuthorizer & { sub?: string };

                if (!decoded.userId) {
                    logger.warn("Auth failed: userId missing in token");
                    throw new UnauthorizedError("Unauthorized: userId missing");
                }

                const userId = decoded.userId || decoded.sub;
                request.event.requestContext = {
                    ...request.event.requestContext,
                    authorizer: {
                        ...decoded,
                        userId,
                    },
                };
                logger.debug("Auth success", { userId });
            } catch (error: unknown) {
                const err = error as { name?: string };
                if (err.name === "TokenExpiredError") {
                    logger.warn("Auth failed: token expired");
                    throw new UnauthorizedError("Unauthorized: Token expired");
                }
                if (err.name === "JsonWebTokenError") {
                    logger.warn("Auth failed: invalid token");
                    throw new UnauthorizedError("Unauthorized: Invalid token");
                }
                logger.warn("Auth failed: token validation error", { errorName: err.name });
                throw new UnauthorizedError("Unauthorized: Token validation failed");
            }
        },
    };
};
