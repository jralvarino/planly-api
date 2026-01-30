import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { StatsService } from "../services/StatsService.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { success } from "../utils/response.util.js";

const service = new StatsService();

const getGlobalStreak = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;
        const currentStreak = await service.getGlobalStreak(userId);
        return success({ currentStreak });
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "GET",
        path: "/stats/globalStreak",
        handler: getGlobalStreak,
    },
];
