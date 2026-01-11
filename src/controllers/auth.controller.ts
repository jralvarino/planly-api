import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { transpileSchema } from "@middy/validator/transpile";
import { Route } from "@middy/http-router";
import middy from "@middy/core";
import validator from "@middy/validator";
import { AuthService } from "../services/AuthService.js";
import { success } from "../utils/response.util.js";
import { loginSchema } from "../schemas/auth.schemas.js";

const authService = new AuthService();

const login = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(validator({ eventSchema: transpileSchema(loginSchema) }))
    .handler(async (event) => {
        const body = (event.body as any) || {};

        const token = await authService.login(body.user, body.password);

        return success({
            token,
        });
    });

export const authRoutes: Route<APIGatewayProxyEvent, APIGatewayProxyResult>[] = [
    {
        method: "POST",
        path: "/auth/login",
        handler: login,
    },
];
