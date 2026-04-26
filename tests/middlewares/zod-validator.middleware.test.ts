import { describe, it, expect, vi } from "vitest";
import { z } from "zod";
import { ValidationError } from "@arj/common-utils-layer/error";

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

import { zodValidator } from "@arj/common-utils-layer/middleware";

const testSchema = z.object({
    body: z.object({
        name: z.string().min(1),
        age: z.number().optional(),
    }),
    pathParameters: z.record(z.string(), z.unknown()).optional(),
    queryStringParameters: z.record(z.string(), z.unknown()).optional(),
});


function makeRequest(
    body: unknown,
    pathParameters?: Record<string, string> | null,
    queryStringParameters?: Record<string, string> | null
) {
    return {
        event: {
            body,
            pathParameters: pathParameters ?? null,
            queryStringParameters: queryStringParameters ?? null,
            path: "/test",
            resource: "/test",
        },
    };
}

describe("zodValidator middleware", () => {
    describe("valid data", () => {
        it("sets validated property on event with valid body", async () => {
            const middleware = zodValidator(testSchema);
            const request = makeRequest({ name: "Alice" });

            await middleware.before!(request as any);

            expect((request.event as any).validated).toBeDefined();
            expect((request.event as any).validated.body).toEqual({ name: "Alice" });
        });

        it("includes queryStringParameters in event data for parsing", async () => {
            const middleware = zodValidator(testSchema);
            const request = makeRequest({ name: "Bob" }, { id: "123" }, { page: "1" });

            await middleware.before!(request as any);

            expect((request.event as any).validated).toBeDefined();
        });

        it("uses empty object when pathParameters is null", async () => {
            const middleware = zodValidator(testSchema);
            const request = makeRequest({ name: "Alice" }, null);

            await middleware.before!(request as any);

            expect((request.event as any).validated).toBeDefined();
        });

        it("uses empty object when queryStringParameters is null", async () => {
            const middleware = zodValidator(testSchema);
            const request = makeRequest({ name: "Alice" }, null, null);

            await middleware.before!(request as any);

            expect((request.event as any).validated).toBeDefined();
        });
    });

    describe("invalid data", () => {
        it("throws ValidationError when body is invalid", async () => {
            const middleware = zodValidator(testSchema);
            const request = makeRequest({ name: "" });

            await expect(middleware.before!(request as any)).rejects.toThrow(ValidationError);
        });

        it("throws ValidationError when body is null", async () => {
            const middleware = zodValidator(testSchema);
            const request = makeRequest(null);

            await expect(middleware.before!(request as any)).rejects.toThrow(ValidationError);
        });

        it("throws ValidationError with message 'Invalid request data'", async () => {
            const middleware = zodValidator(testSchema);
            const request = makeRequest({ name: "" });

            try {
                await middleware.before!(request as any);
                expect.fail("Expected to throw");
            } catch (err) {
                expect(err).toBeInstanceOf(ValidationError);
                expect((err as ValidationError).message).toBe("Invalid request data");
            }
        });

        it("includes field details in ValidationError", async () => {
            const middleware = zodValidator(testSchema);
            const request = makeRequest({ name: "" });

            try {
                await middleware.before!(request as any);
            } catch (err) {
                const details = (err as ValidationError).details as Array<{ field: string; message: string }>;
                expect(Array.isArray(details)).toBe(true);
                expect(details.length).toBeGreaterThan(0);
                expect(details[0]).toHaveProperty("field");
                expect(details[0]).toHaveProperty("message");
            }
        });
    });
});
