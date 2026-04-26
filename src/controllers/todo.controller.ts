import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { updateTodoStatusSchema, updateTodoNotesSchema } from "../schemas/todo.schemas.js";
import { TodoService, UpdateStatusParams } from "../services/TodoService.js";
import { TodoStatus } from "../constants/todo.constants.js";
import { zodValidator } from "@arj/arj-common-utils/middleware";
import type { WithUserId } from "@arj/arj-common-utils/middleware";
import { success, noContent, createLogger } from "@arj/arj-common-utils/util";
import { BadRequestError } from "@arj/arj-common-utils/error";
import { container } from "../container.js";

const logger = createLogger("planly-api");

const todoService = container.resolve(TodoService);

type EventWithUser = APIGatewayProxyEvent & WithUserId;

const getTodoListByDate = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
        const date = event.queryStringParameters?.date || "";

        const todoList = await todoService.getTodoListByDate(userId, date);

        return success(todoList);
    });

const createOrUpdateTodo = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(zodValidator(updateTodoStatusSchema))
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
        const { body, pathParameters } = (
            event as EventWithUser & {
                validated: {
                    body: { date: string; status: string; progressValue?: number; notes?: string };
                    pathParameters: { habitId: string };
                };
            }
        ).validated;

        const updateParams: UpdateStatusParams = {
            userId,
            habitId: pathParameters.habitId,
            date: body.date,
            status: body.status as TodoStatus,
            progressValue: body.progressValue,
        };

        await todoService.createOrUpdate(updateParams);
        return noContent();
    });

const getDailySummary = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
        const startDate = event.queryStringParameters?.startDate;
        const endDate = event.queryStringParameters?.endDate;

        if (!startDate || !endDate) {
            logger.warn("Todo dailySummary: missing params", { userId, startDate, endDate });
            throw new BadRequestError("startDate and endDate query parameters are required");
        }

        const dailySummary = await todoService.getDailySummary(userId, startDate, endDate);

        return success(dailySummary);
    });

const updateTodoNotes = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(zodValidator(updateTodoNotesSchema))
    .handler(async (event) => {
        const { userId } = event as EventWithUser;
        const { body, pathParameters } = (
            event as EventWithUser & {
                validated: { body: { date: string; notes: string }; pathParameters: { habitId: string } };
            }
        ).validated;

        await todoService.updateNotes(userId, pathParameters.habitId, body.date, body.notes);

        return noContent();
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "GET",
        path: "/planly/todo/date",
        handler: getTodoListByDate,
    },
    {
        method: "GET",
        path: "/planly/todo/summary",
        handler: getDailySummary,
    },
    {
        method: "PATCH",
        path: "/planly/todo/{habitId}",
        handler: createOrUpdateTodo,
    },
    {
        method: "PATCH",
        path: "/planly/todo/{habitId}/notes",
        handler: updateTodoNotes,
    },
];
