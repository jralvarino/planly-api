import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";
import {
    createHabitSchema,
    updateHabitSchema,
    getHabitsSchema,
    getHabitByIdSchema,
    getHabitsByCategorySchema,
    deleteHabitSchema,
} from "../schemas/habit.schemas.js";
import { HabitService } from "../services/HabitService.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { created, success } from "../utils/response.util.js";

const service = new HabitService();

const createHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(validator({ eventSchema: transpileSchema(createHabitSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const body = (event.body as any) || {};

        const habit = await service.create(userId, body);

        return created(habit);
    });

const updateHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(validator({ eventSchema: transpileSchema(updateHabitSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const id = event.pathParameters!.id!;
        const body = (event.body as any) || {};

        const habit = await service.update(userId, id, body);

        return success(habit);
    });

const getAllHabits = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(validator({ eventSchema: transpileSchema(getHabitsSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const habits = await service.getAllHabits(userId);

        return success(habits);
    });

const getHabitById = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(validator({ eventSchema: transpileSchema(getHabitByIdSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const id = event.pathParameters!.id!;

        const habit = await service.getHabitById(userId, id);

        return success(habit);
    });

const getHabitsByDate = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(validator({ eventSchema: transpileSchema(getHabitsByDateSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const date = event.queryStringParameters?.date || "";

        const habits = await service.getHabitsByDate(userId, date);

        return success(habits);
    });

const deleteHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    //.use(validator({ eventSchema: transpileSchema(deleteHabitSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const id = event.pathParameters!.id!;

        await service.delete(userId, id);

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
        method: "GET",
        path: "/habits/date",
        handler: getHabitsByDate,
    },
    {
        method: "DELETE",
        path: "/habits/{id}",
        handler: deleteHabit,
    },
];
