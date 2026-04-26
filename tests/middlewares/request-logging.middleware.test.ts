import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

import { requestLoggingMiddleware } from "@arj/common-utils-layer/middleware";

function makeRequest(eventOverrides: Record<string, unknown> = {}) {
    return {
        event: {
            httpMethod: "GET",
            path: "/test",
            resource: "/test",
            pathParameters: null,
            queryStringParameters: null,
            body: null,
            ...eventOverrides,
        },
        response: null,
    };
}

describe("requestLoggingMiddleware", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("returns middleware object with before and after hooks", () => {
        const middleware = requestLoggingMiddleware();
        expect(typeof middleware.before).toBe("function");
        expect(typeof middleware.after).toBe("function");
    });

    describe("before hook", () => {
        it("does not throw on standard request", async () => {
            const middleware = requestLoggingMiddleware();
            const request = makeRequest();
            await expect(middleware.before!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when httpMethod is missing", async () => {
            const middleware = requestLoggingMiddleware();
            const request = makeRequest({ httpMethod: undefined });
            await expect(middleware.before!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when pathParameters is present", async () => {
            const middleware = requestLoggingMiddleware();
            const request = makeRequest({ pathParameters: { id: "123" } });
            await expect(middleware.before!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when pathParameters is null", async () => {
            const middleware = requestLoggingMiddleware();
            const request = makeRequest({ pathParameters: null });
            await expect(middleware.before!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when queryStringParameters is present", async () => {
            const middleware = requestLoggingMiddleware();
            const request = makeRequest({ queryStringParameters: { page: "1" } });
            await expect(middleware.before!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when body is a JSON string", async () => {
            const middleware = requestLoggingMiddleware();
            const request = makeRequest({ body: '{"name":"test"}' });
            await expect(middleware.before!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when body is null", async () => {
            const middleware = requestLoggingMiddleware();
            const request = makeRequest({ body: null });
            await expect(middleware.before!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when resource is used as path fallback", async () => {
            const middleware = requestLoggingMiddleware();
            const request = makeRequest({ path: undefined, resource: "/resource" });
            await expect(middleware.before!(request as any)).resolves.toBeUndefined();
        });
    });

    describe("after hook", () => {
        it("does not throw with a response", async () => {
            const middleware = requestLoggingMiddleware();
            const request = {
                event: {},
                response: { statusCode: 200, body: '{"ok":true}' },
            };
            await expect(middleware.after!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw with null response", async () => {
            const middleware = requestLoggingMiddleware();
            const request = { event: {}, response: null };
            await expect(middleware.after!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when body is invalid JSON", async () => {
            const middleware = requestLoggingMiddleware();
            const request = {
                event: {},
                response: { statusCode: 200, body: "not-json" },
            };
            await expect(middleware.after!(request as any)).resolves.toBeUndefined();
        });

        it("does not throw when body is empty", async () => {
            const middleware = requestLoggingMiddleware();
            const request = {
                event: {},
                response: { statusCode: 204, body: "" },
            };
            await expect(middleware.after!(request as any)).resolves.toBeUndefined();
        });
    });
});
