import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { StatsService } from "../services/StatsService.js";
import { authMiddleware, getUserId } from "../middlewares/auth.middleware.js";
import { zodValidator } from "../middlewares/zod-validator.middleware.js";
import { getDashboardSchema } from "../schemas/stats.schemas.js";
import { success } from "../utils/response.util.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";

const getStatsService = () => container.resolve(StatsService);

const getGlobalStreak = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = getUserId(event);

        const currentStreak = await getStatsService().getGlobalStreak(userId);

        return success({ currentStreak });
    });

type ValidatedDashboard = APIGatewayProxyEvent & {
    validated: { queryStringParameters: { month: string; categoryId?: string; selectedDate?: string } };
};

const getDashboard = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(getDashboardSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const { month, categoryId, selectedDate } = (event as ValidatedDashboard).validated.queryStringParameters;

        const data = await getStatsService().getDashboardData(userId, month, categoryId, selectedDate);

        return success(data);
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "GET",
        path: "/stats/globalStreak",
        handler: getGlobalStreak,
    },
    {
        method: "GET",
        path: "/stats/dashboard",
        handler: getDashboard,
    },
];
