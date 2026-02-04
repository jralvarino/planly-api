import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { HabitService } from "../services/HabitService.js";
import { authMiddleware, getUserId } from "../middlewares/auth.middleware.js";
import { zodValidator } from "../middlewares/zod-validator.middleware.js";
import {
    createHabitSchema,
    updateHabitSchema,
    getHabitByIdSchema,
    deleteHabitSchema,
} from "../schemas/habit.schemas.js";
import { created, success } from "../utils/response.util.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";

const habitService = container.resolve(HabitService);

const createHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(createHabitSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const body = ((event.body ?? {}) as Record<string, unknown>) || {};

        const habit = await habitService.create(userId, body);

        return created(habit);
    });

const updateHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(updateHabitSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const id = event.pathParameters!.id!;
        const body = ((event.body ?? {}) as Record<string, unknown>) || {};

        const habit = await habitService.update(userId, id, body);

        return success(habit);
    });

const getAllHabits = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = getUserId(event);
        const categoryId = event.queryStringParameters?.categoryId;

        const habits = await habitService.getAllHabits(userId, categoryId);

        return success(habits);
    });

const getHabitById = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(getHabitByIdSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const id = event.pathParameters!.id!;

        const habit = await habitService.getHabitById(userId, id);

        return success(habit);
    });

const deleteHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(deleteHabitSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const id = event.pathParameters!.id!;

        await habitService.delete(userId, id);

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
