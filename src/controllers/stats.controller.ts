import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { StatsService } from "../services/StatsService.js";
import { zodValidator } from "@arj/common-utils-layer/middleware";
import type { WithUserId } from "@arj/common-utils-layer/middleware";
import { getDashboardSchema } from "../schemas/stats.schemas.js";
import { success } from "@arj/common-utils-layer/util";
import { container } from "../container.js";


const statsService = container.resolve(StatsService);

type EventWithUser = APIGatewayProxyEvent & WithUserId;

const getGlobalStreak = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .handler(async (event) => {
        const { userId } = event as EventWithUser;

        const currentStreak = await statsService.getGlobalStreak(userId);

        return success({ currentStreak });
    });

type ValidatedDashboard = EventWithUser & {
    validated: {
        queryStringParameters: { month: string; categoryId?: string; habitId?: string; selectedDate?: string };
    };
};

const getDashboard = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(zodValidator(getDashboardSchema))
    .handler(async (event) => {
        const { userId, validated } = event as ValidatedDashboard;
        const { month, categoryId, habitId, selectedDate } = validated.queryStringParameters;

        const data = await statsService.getDashboardData(userId, month, categoryId, habitId, selectedDate);

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
