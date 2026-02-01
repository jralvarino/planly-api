import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import { AuthService } from "../services/AuthService.js";
import { success } from "../utils/response.util.js";
import { loginSchema } from "../schemas/auth.schemas.js";
import { zodValidator } from "../middlewares/zod-validator.middleware.js";
import { container } from "../container.js";
import { logger } from "../utils/logger.js";

const getAuthService = () => container.resolve(AuthService);

const login = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(zodValidator(loginSchema))
    .handler(async (event) => {
        const { body } = (event as APIGatewayProxyEvent & { validated: { body: { user: string; password: string } } }).validated;

        const token = await getAuthService().login(body.user, body.password);

        return success({ token });
    });

export const authRoutes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "POST",
        path: "/auth/login",
        handler: login,
    },
];
