import "../../container.js";
import middy from "@middy/core";
import httpEventNormalizer from "@middy/http-event-normalizer";
import jsonBodyParser from "@middy/http-json-body-parser";
import httpRouterHandler from "@middy/http-router";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";

import { routes } from "../../controllers/category.controller.js";
import { createLogger } from "@arj/common-utils-layer/util";
import { globalExceptionHandler, requestLoggingMiddleware, extractUserIdMiddleware } from "@arj/common-utils-layer/middleware";
import { tracer } from "../../utils/tracer.js";

const logger = createLogger("planly-api");

const handler = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(captureLambdaHandler(tracer))
    .use(injectLambdaContext(logger))
    .use(jsonBodyParser({ disableContentTypeCheck: true } as any))
    .use(httpEventNormalizer())
    .use(requestLoggingMiddleware())
    .use(extractUserIdMiddleware())
    .use(globalExceptionHandler())
    .handler(httpRouterHandler(routes));

export { handler };
export default handler;
