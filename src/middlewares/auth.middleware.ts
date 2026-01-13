import type { MiddlewareObj } from "@middy/core";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import jwt from "jsonwebtoken";
import { UnauthorizedError } from "../errors/PlanlyError.js";
import { getJwtSecret } from "../utils/secretsManager.js";

export interface AuthContext {
    userId: string;
    email?: string;
    [key: string]: any;
}

export const authMiddleware = (): MiddlewareObj<APIGatewayProxyEvent, APIGatewayProxyResult> => {
    return {
        before: async (request) => {
            console.log("HEADERS: ", request.event.headers);
            console.log("BODY: ", request.event.body);
            const authHeader = request.event.headers.Authorization || request.event.headers.authorization;

            if (!authHeader) {
                throw new UnauthorizedError("Unauthorized: Token missing");
            }

            const token = authHeader.replace("Bearer ", "").trim();

            if (!token) {
                throw new UnauthorizedError("Unauthorized: Token missing");
            }

            try {
                const jwtSecret = await getJwtSecret();
                const decoded = jwt.verify(token, jwtSecret) as any;

                if (!decoded.userId) {
                    throw new UnauthorizedError("Unauthorized: userId missing");
                }

                request.event.requestContext = {
                    ...request.event.requestContext,
                    authorizer: {
                        userId: decoded.userId || decoded.sub,
                        ...decoded,
                    },
                };
            } catch (error: any) {
                if (error.name === "TokenExpiredError") {
                    throw new UnauthorizedError("Unauthorized: Token expired");
                }
                if (error.name === "JsonWebTokenError") {
                    throw new UnauthorizedError("Unauthorized: Invalid token");
                }
                throw new UnauthorizedError("Unauthorized: Token validation failed");
            }
        },
    };
};
