import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { HabitService } from "../services/HabitService.js";
import { authMiddleware, getUserId } from "../middlewares/auth.middleware.js";
import { created, success } from "../utils/response.util.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";

const getHabitService = () => container.resolve(HabitService);

const createHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(zodValidator(createHabitSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const body = ((event.body ?? {}) as Record<string, unknown>) || {};

        const habit = await getHabitService().create(userId, body);

        return created(habit);
    });

const updateHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(zodValidator(updateHabitSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const id = event.pathParameters!.id!;
        const body = ((event.body ?? {}) as Record<string, unknown>) || {};

        const habit = await getHabitService().update(userId, id, body);

        return success(habit);
    });

const getAllHabits = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(zodValidator(getHabitsSchema))
    .handler(async (event) => {
        const userId = getUserId(event);

        const habits = await getHabitService().getAllHabits(userId);

        return success(habits);
    });

const getHabitById = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(zodValidator(getHabitByIdSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const id = event.pathParameters!.id!;

        const habit = await getHabitService().getHabitById(userId, id);

        return success(habit);
    });

const deleteHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(zodValidator(deleteHabitSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const id = event.pathParameters!.id!;

        await getHabitService().delete(userId, id);
        
        return success({ message: "Habit deleted successfully" });
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "POST",
        path: "/habits",
        handler: createHabit,
    },
    {
        method: "PUT",
        path: "/habits/{id}",
        handler: updateHabit,
    },
    {
        method: "GET",
        path: "/habits",
        handler: getAllHabits,
    },
    {
        method: "GET",
        path: "/habits/{id}",
        handler: getHabitById,
    },
    {
        method: "DELETE",
        path: "/habits/{id}",
        handler: deleteHabit,
    },
];
