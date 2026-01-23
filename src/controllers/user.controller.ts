import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { UserService } from "../services/UserService.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { success } from "../utils/response.util.js";

const service = new UserService();

const getProfile = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;
        const profile = await service.getProfile(userId);
        return success(profile);
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "GET",
        path: "/user",
        handler: getProfile,
    },
];

