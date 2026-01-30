import middy from "@middy/core";
import httpEventNormalizer from "@middy/http-event-normalizer";
import jsonBodyParser from "@middy/http-json-body-parser";
import httpRouterHandler from "@middy/http-router";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { routes } from "../../controllers/category.controller.js";
import { authRoutes } from "../../controllers/auth.controller.js";
import { routes as userRoutes } from "../../controllers/user.controller.js";
import { globalExceptionHandler } from "../../middlewares/global-exception-handler.middleware.js";
import { requestLoggingMiddleware } from "../../middlewares/request-logging.middleware.js";

// Combinar todas as rotas
const allRoutes = [...authRoutes, ...userRoutes, ...routes];

const handler = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(jsonBodyParser({ disableContentTypeCheck: true } as any))
    .use(httpEventNormalizer())
    .use(requestLoggingMiddleware())
    .use(globalExceptionHandler())
    .handler(httpRouterHandler(allRoutes));

export { handler };
export default handler;
