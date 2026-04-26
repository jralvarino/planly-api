import { describe, it, expect, vi, beforeEach } from "vitest";
import { z, ZodError } from "zod";

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

import { globalExceptionHandler } from "@arj/common-utils-layer/middleware";
import { NotFoundError, InternalServerError, CommonError as PlanlyError, ConflictError } from "@arj/common-utils-layer/error";

function makeRequest(error: Error) {
    return { error, response: undefined as any };
}

function createZodError(): ZodError {
    try {
        z.object({ name: z.string(), age: z.number() }).parse({ name: 123, age: "not-a-number" });
    } catch (e) {
        return e as ZodError;
    }
    throw new Error("Expected ZodError");
}

describe("globalExceptionHandler", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe("ZodError handling", () => {
        it("returns 400 with VALIDATION_ERROR type", async () => {
            const middleware = globalExceptionHandler();
            const request = makeRequest(createZodError());
            await middleware.onError!(request as any);

            expect(request.response.statusCode).toBe(400);
            const body = JSON.parse(request.response.body);
            expect(body.errorType).toBe("VALIDATION_ERROR");
            expect(body.message).toBe("Invalid request data");
            expect(body.details).toBeDefined();
            expect(Array.isArray(body.details)).toBe(true);
        });

        it("includes formatted field errors in details", async () => {
            const middleware = globalExceptionHandler();
            const request = makeRequest(createZodError());
            await middleware.onError!(request as any);

            const body = JSON.parse(request.response.body);
            expect(body.details.length).toBeGreaterThan(0);
            expect(body.details[0]).toHaveProperty("field");
            expect(body.details[0]).toHaveProperty("message");
        });
    });

    describe("PlanlyError handling (4xx)", () => {
        it("returns 404 for NotFoundError", async () => {
            const middleware = globalExceptionHandler();
            const request = makeRequest(new NotFoundError("Resource not found"));
            await middleware.onError!(request as any);

            expect(request.response.statusCode).toBe(404);
            const body = JSON.parse(request.response.body);
            expect(body.errorType).toBe("NOT_FOUND");
            expect(body.message).toBe("Resource not found");
        });

        it("returns 409 for ConflictError", async () => {
            const middleware = globalExceptionHandler();
            const request = makeRequest(new ConflictError("Already exists"));
            await middleware.onError!(request as any);

            expect(request.response.statusCode).toBe(409);
            const body = JSON.parse(request.response.body);
            expect(body.errorType).toBe("CONFLICT");
        });

        it("includes details when present", async () => {
            const middleware = globalExceptionHandler();
            const err = new PlanlyError("bad", 400, "BAD_REQUEST", { extra: "info" });
            const request = makeRequest(err);
            await middleware.onError!(request as any);

            const body = JSON.parse(request.response.body);
            expect(body.details).toEqual({ extra: "info" });
        });
    });

    describe("PlanlyError handling (5xx)", () => {
        it("returns 500 for InternalServerError", async () => {
            const middleware = globalExceptionHandler();
            const request = makeRequest(new InternalServerError("Crashed"));
            await middleware.onError!(request as any);

            expect(request.response.statusCode).toBe(500);
            const body = JSON.parse(request.response.body);
            expect(body.errorType).toBe("INTERNAL_SERVER_ERROR");
        });
    });

    describe("Generic Error handling", () => {
        it("returns 500 for a plain Error", async () => {
            const middleware = globalExceptionHandler();
            const request = makeRequest(new Error("Unexpected failure"));
            await middleware.onError!(request as any);

            expect(request.response.statusCode).toBe(500);
            const body = JSON.parse(request.response.body);
            expect(body.errorType).toBe("INTERNAL_SERVER_ERROR");
        });

        it("uses statusCode from error if present", async () => {
            const middleware = globalExceptionHandler();
            const err = new Error("Custom error") as Error & { statusCode: number };
            err.statusCode = 502;
            const request = makeRequest(err);
            await middleware.onError!(request as any);

            expect(request.response.statusCode).toBe(502);
        });

        it("sets Content-Type header", async () => {
            const middleware = globalExceptionHandler();
            const request = makeRequest(new Error("err"));
            await middleware.onError!(request as any);

            expect(request.response.headers?.["Content-Type"]).toBe("application/json");
        });
    });
});
