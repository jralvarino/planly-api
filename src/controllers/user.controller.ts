import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { UserService } from "../services/UserService.js";
import { authMiddleware, getUserId } from "../middlewares/auth.middleware.js";
import { success } from "../utils/response.util.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";

const getUserService = () => container.resolve(UserService);

const getProfile = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = getUserId(event);

        const profile = await getUserService().getProfile(userId);
        
        return success(profile);
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "GET",
        path: "/user",
        handler: getProfile,
    },
];

