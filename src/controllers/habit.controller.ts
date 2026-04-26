import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { HabitService } from "../services/HabitService.js";
import { zodValidator } from "@arj/common-utils-layer/middleware";
import type { WithUserId } from "@arj/common-utils-layer/middleware";
import {
    createHabitSchema,
    updateHabitSchema,
    getHabitByIdSchema,
    deleteHabitSchema,
} from "../schemas/habit.schemas.js";
import { created, success } from "@arj/common-utils-layer/util";
import { container } from "../container.js";


const habitService = container.resolve(HabitService);

type EventWithUser = APIGatewayProxyEvent & WithUserId;

const createHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(zodValidator(createHabitSchema))
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
        const body = ((event.body ?? {}) as Record<string, unknown>) || {};

        const habit = await habitService.create(userId, body);

        return created(habit);
    });

const updateHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(zodValidator(updateHabitSchema))
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
        const id = event.pathParameters!.id!;
        const body = ((event.body ?? {}) as Record<string, unknown>) || {};

        const habit = await habitService.update(userId, id, body);

        return success(habit);
    });

const getAllHabits = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
        const categoryId = event.queryStringParameters?.categoryId;

        const habits = await habitService.getAllHabits(userId, categoryId);

        return success(habits);
    });

const getHabitById = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(zodValidator(getHabitByIdSchema))
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
        const id = event.pathParameters!.id!;

        const habit = await habitService.getHabitById(userId, id);

        return success(habit);
    });

const deleteHabit = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(zodValidator(deleteHabitSchema))
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
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
