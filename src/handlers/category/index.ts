import "../../container.js";
import middy from "@middy/core";
import httpEventNormalizer from "@middy/http-event-normalizer";
import jsonBodyParser from "@middy/http-json-body-parser";
import httpRouterHandler from "@middy/http-router";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";

import { routes } from "../../controllers/category.controller.js";
import { authRoutes } from "../../controllers/auth.controller.js";
import { routes as userRoutes } from "../../controllers/user.controller.js";
import { logger } from "../../utils/logger.js";
import { tracer } from "../../utils/tracer.js";
import { globalExceptionHandler } from "../../middlewares/global-exception-handler.middleware.js";
import { requestLoggingMiddleware } from "../../middlewares/request-logging.middleware.js";

const allRoutes = [...authRoutes, ...userRoutes, ...routes];

const handler = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(jsonBodyParser({ disableContentTypeCheck: true } as any))
    .use(httpEventNormalizer())
    .use(requestLoggingMiddleware())
    .use(globalExceptionHandler())
    .handler(httpRouterHandler(allRoutes));

export { handler };
export default handler;
