import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import validator from "@middy/validator";
import { transpileSchema } from "@middy/validator/transpile";
import {
    createCategorySchema,
    updateCategorySchema,
    getCategoriesSchema,
    getCategoryByNameSchema,
    deleteCategorySchema,
} from "../schemas/category.schemas.js";
import { CategoryService } from "../services/CategoryService.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { created, success } from "../utils/response.util.js";

const service = new CategoryService();

const createCategory = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(validator({ eventSchema: transpileSchema(createCategorySchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const body = (event.body as any) || {};

        const category = await service.create(userId, body.name);

        return created({ category });
    });

const updateCategory = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(validator({ eventSchema: transpileSchema(updateCategorySchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const id = event.pathParameters!.id!;
        const body = (event.body as any) || {};

        const category = await service.update(userId, id, body.name);

        return success({ category });
    });

const getAllCategories = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(validator({ eventSchema: transpileSchema(getCategoriesSchema) }))
    .handler(async (event) => {
        console.log(event);
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const categories = await service.getAllCategories(userId);

        return success(Object.values(categories));
    });

const getCategoryById = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(validator({ eventSchema: transpileSchema(getCategoryByNameSchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const id = event.pathParameters!.id!;

        const category = await service.getCategoryById(userId, id);

        return success(category);
    });

const deleteCategory = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(validator({ eventSchema: transpileSchema(deleteCategorySchema) }))
    .handler(async (event) => {
        const userId = (event.requestContext?.authorizer as any)?.userId;

        const id = event.pathParameters!.id!;

        await service.delete(userId, id);

        return success({ message: "Category deleted successfully" });
    });

export const routes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "POST",
        path: "/categories",
        handler: createCategory,
    },
    {
        method: "PUT",
        path: "/categories/{id}",
        handler: updateCategory,
    },
    {
        method: "GET",
        path: "/categories",
        handler: getAllCategories,
    },
    {
        method: "GET",
        path: "/categories/{id}",
        handler: getCategoryById,
    },
    {
        method: "DELETE",
        path: "/categories/{id}",
        handler: deleteCategory,
    },
];
