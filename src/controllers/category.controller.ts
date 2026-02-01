import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import {
    createCategorySchema,
    updateCategorySchema,
    getCategoryByIdSchema,
    deleteCategorySchema,
} from "../schemas/category.schemas.js";
import { CategoryService } from "../services/CategoryService.js";
import { authMiddleware, getUserId } from "../middlewares/auth.middleware.js";
import { zodValidator } from "../middlewares/zod-validator.middleware.js";
import { created, success } from "../utils/response.util.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";

const getCategoryService = () => container.resolve(CategoryService);

const createCategory = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(createCategorySchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const { body } = (event as APIGatewayProxyEvent & { validated: { body: { name: string } } }).validated;

        const category = await getCategoryService().create(userId, body.name);

        return created({ category });
    });

const updateCategory = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(updateCategorySchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const { body, pathParameters } = (event as APIGatewayProxyEvent & { validated: { body: { name: string }; pathParameters: { id: string } } }).validated;

        const category = await getCategoryService().update(userId, pathParameters.id, body.name);
    
        return success({ category });
    });

const getAllCategories = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .handler(async (event) => {
        const userId = getUserId(event);

        const categories = await getCategoryService().getAllCategories(userId);

        return success(Object.values(categories));
    });

const getCategoryById = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(getCategoryByIdSchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const { pathParameters } = (event as APIGatewayProxyEvent & { validated: { pathParameters: { id: string } } }).validated;

        const category = await getCategoryService().getCategoryById(userId, pathParameters.id);

        return success(category);
    });

const deleteCategory = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(authMiddleware())
    .use(zodValidator(deleteCategorySchema))
    .handler(async (event) => {
        const userId = getUserId(event);
        const { pathParameters } = (event as APIGatewayProxyEvent & { validated: { pathParameters: { id: string } } }).validated;

        await getCategoryService().delete(userId, pathParameters.id);
        
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
