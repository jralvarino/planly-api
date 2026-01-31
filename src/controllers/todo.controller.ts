import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { updateTodoStatusSchema, updateTodoNotesSchema } from "../schemas/todo.schemas.js";
import { TodoService, UpdateStatusParams } from "../services/TodoService.js";
import { TodoStatus } from "../constants/todo.constants.js";
import { authMiddleware, getUserId } from "../middlewares/auth.middleware.js";
import { zodValidator } from "../middlewares/zod-validator.middleware.js";
import { success, noContent } from "../utils/response.util.js";
import { BadRequestError } from "../errors/PlanlyError.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";

const getTodoService = () => container.resolve(TodoService);

const getTodoListByDate = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = getUserId(event);
        const date = event.queryStringParameters?.date || "";

        logger.info("Todo listByDate", { userId, date });
        const todoList = await getTodoService().getTodoListByDate(userId, date);
        logger.info("Todo listByDate result", { userId, date, count: todoList.length });
        return success(todoList);
    });

const createOrUpdateTodo = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(updateTodoStatusSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const { body, pathParameters } = (event as APIGatewayProxyEvent & { validated: { body: { date: string; status: string; progressValue?: number; notes?: string }; pathParameters: { habitId: string } } }).validated;

        logger.info("Todo createOrUpdate", { userId, habitId: pathParameters.habitId, date: body.date, status: body.status });
        const updateParams: UpdateStatusParams = {
            userId,
            habitId: pathParameters.habitId,
            date: body.date,
            status: body.status as TodoStatus,
            progressValue: body.progressValue,
        };

        await getTodoService().createOrUpdate(updateParams);
        return noContent();
    });

const getDailySummary = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = getUserId(event);
        const startDate = event.queryStringParameters?.startDate;
        const endDate = event.queryStringParameters?.endDate;

        if (!startDate || !endDate) {
            logger.warn("Todo dailySummary: missing params", { userId, startDate, endDate });
            throw new BadRequestError("startDate and endDate query parameters are required");
        }

        logger.info("Todo dailySummary", { userId, startDate, endDate });
        const dailySummary = await getTodoService().getDailySummary(userId, startDate, endDate);
        logger.info("Todo dailySummary result", { userId, dayCount: dailySummary.length });
        return success(dailySummary);
    });

const updateTodoNotes = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(updateTodoNotesSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const { body, pathParameters } = (event as APIGatewayProxyEvent & { validated: { body: { date: string; notes: string }; pathParameters: { habitId: string } } }).validated;

        logger.info("Todo updateNotes", { userId, habitId: pathParameters.habitId, date: body.date });
        await getTodoService().updateNotes(userId, pathParameters.habitId, body.date, body.notes);
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
