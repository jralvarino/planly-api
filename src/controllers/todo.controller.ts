import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";
import { updateTodoStatusSchema, updateTodoNotesSchema } from "../schemas/todo.schemas.js";
import { TodoService, UpdateStatusParams } from "../services/TodoService.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { success, noContent } from "../utils/response.util.js";

const service = new TodoService();

const getTodoListByDate = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const date = event.queryStringParameters?.date || "";

        const habits = await service.getTodoListByDate(userId, date);

        return success(habits);
    });

const createOrUpdateTodo = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(validator({ eventSchema: transpileSchema(updateTodoStatusSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;
        const habitId = event.pathParameters!.habitId!;
        const body = (event.body as any) || {};

        const updateParams: UpdateStatusParams = {
            userId,
            habitId,
            date: body.date,
            status: body.status,
            progressValue: body.progressValue
        };

        await service.createOrUpdate(updateParams);

        return noContent();
    });

const getDailySummary = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;
        const startDate = event.queryStringParameters?.startDate;
        const endDate = event.queryStringParameters?.endDate;

        if (!startDate || !endDate) {
            return {
                statusCode: 400,
                body: JSON.stringify({
                    error: "startDate and endDate query parameters are required",
                }),
            };
        }

        const dailySummary = await service.getDailySummary(userId, startDate, endDate);

        return success(dailySummary);
    });

const updateTodoNotes = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(validator({ eventSchema: transpileSchema(updateTodoNotesSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;
        const habitId = event.pathParameters!.habitId!;
        const body = (event.body as any) || {};

        await service.updateNotes(userId, habitId, body.date, body.notes);

        return noContent();
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "GET",
        path: "/todo/date",
        handler: getTodoListByDate,
    },
    {
        method: "GET",
        path: "/todo/summary",
        handler: getDailySummary,
    },
    {
        method: "PATCH",
        path: "/todo/{habitId}",
        handler: createOrUpdateTodo,
    },
    {
        method: "PATCH",
        path: "/todo/{habitId}/notes",
        handler: updateTodoNotes,
    },
];
