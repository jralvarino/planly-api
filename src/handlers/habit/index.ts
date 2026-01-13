import middy from "@middy/core";
import httpEventNormalizer from "@middy/http-event-normalizer";
import jsonBodyParser from "@middy/http-json-body-parser";
import httpRouterHandler from "@middy/http-router";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

import { routes } from "../../controllers/habit.controller.js";
import { globalExceptionHandler } from "../../middlewares/global-exception-handler.middleware.js";

const handler = middy<APIGatewayProxyEvent, APIGatewayProxyResult>()
    .use(jsonBodyParser({ disableContentTypeCheck: true } as any))
    .use(httpEventNormalizer())
    .use(globalExceptionHandler())
    .handler(httpRouterHandler(routes));

export { handler };
export default handler;
