import type { APIGatewayProxyEvent } from "aws-lambda";
import { UnauthorizedError } from "../errors/PlanlyError.js";

export interface PlanlyAuthorizer {
    userId: string;
    name?: string;
}

export function getUserId(event: APIGatewayProxyEvent): string {
    const authorizer = event.requestContext?.authorizer as PlanlyAuthorizer | undefined;
    const userId = authorizer?.userId;
    if (!userId) {
        throw new UnauthorizedError("Unauthorized: userId missing");
    }
    return userId;
}
