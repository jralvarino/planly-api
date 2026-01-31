import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { StatsService } from "../services/StatsService.js";
import { authMiddleware, getUserId } from "../middlewares/auth.middleware.js";
import { success } from "../utils/response.util.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";

const getStatsService = () => container.resolve(StatsService);

const getGlobalStreak = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = getUserId(event);
        logger.info("Stats getGlobalStreak", { userId });
        const currentStreak = await getStatsService().getGlobalStreak(userId);
        logger.info("Stats getGlobalStreak result", { userId, currentStreak });
        return success({ currentStreak });
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "GET",
        path: "/stats/globalStreak",
        handler: getGlobalStreak,
    },
];
