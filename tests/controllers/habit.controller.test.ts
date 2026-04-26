import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreate, mockUpdate, mockGetAll, mockGetById, mockDelete } = vi.hoisted(() => ({
    mockCreate: vi.fn(),
    mockUpdate: vi.fn(),
    mockGetAll: vi.fn(),
    mockGetById: vi.fn(),
    mockDelete: vi.fn(),
}));

vi.mock("@arj/common-utils-layer/util", async (importOriginal) => {
    const actual = await importOriginal();
    return {
        ...(actual as object),
        createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
    };
});

vi.mock("../../src/container.js", () => ({
    container: {
        resolve: vi.fn(() => ({
            create: mockCreate,
            update: mockUpdate,
            getAllHabits: mockGetAll,
            getHabitById: mockGetById,
            delete: mockDelete,
        })),
    },
}));

import { routes } from "../../src/controllers/habit.controller.js";

function makeEvent(overrides: Record<string, unknown> = {}): any {
    return {
        httpMethod: "GET",
        path: "/habits",
        headers: {},
        multiValueHeaders: {},
        queryStringParameters: null,
        multiValueQueryStringParameters: null,
        pathParameters: null,
        stageVariables: null,
        requestContext: {
            authorizer: { userId: "user-1" },
        },
        userId: "user-1",
        body: null,
        isBase64Encoded: false,
        resource: "",
        ...overrides,
    };
}

describe("habit.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("POST /habits - creates a habit", async () => {
        const habit = { id: "habit-1", title: "Exercise", userId: "user-1" };
        mockCreate.mockResolvedValue(habit);

        const handler = routes.find((r) => r.method === "POST")!.handler as any;
        const body = {
            title: "Exercise",
            color: "#fff",
            emoji: "💪",
            unit: "count",
            value: "1",
            period_type: "every_day",
            period: "Anytime",
            categoryId: "cat-1",
            start_date: "2024-01-01",
        };
        const event = makeEvent({
            httpMethod: "POST",
            body: body,
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(201);
        expect(mockCreate).toHaveBeenCalledWith("user-1", body);
    });

    it("PUT /habits/{id} - updates a habit", async () => {
        const habit = { id: "habit-1", title: "Exercise Updated" };
        mockUpdate.mockResolvedValue(habit);

        const handler = routes.find((r) => r.method === "PUT")!.handler as any;
        const body = {
            title: "Exercise Updated",
            color: "#fff",
            emoji: "💪",
            unit: "count",
            value: "1",
            period_type: "every_day",
            period: "Anytime",
            categoryId: "cat-1",
            start_date: "2024-01-01",
        };
        const event = makeEvent({
            httpMethod: "PUT",
            pathParameters: { id: "habit-1" },
            body: body,
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockUpdate).toHaveBeenCalledWith("user-1", "habit-1", body);
    });

    it("GET /habits - returns all habits without categoryId", async () => {
        const habits = [{ id: "habit-1" }];
        mockGetAll.mockResolvedValue(habits);

        const handler = routes.find((r) => r.method === "GET" && r.path === "/habits")!.handler as any;
        const event = makeEvent({ httpMethod: "GET" });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetAll).toHaveBeenCalledWith("user-1", undefined);
    });

    it("GET /habits - returns habits filtered by categoryId", async () => {
        const habits = [{ id: "habit-1" }];
        mockGetAll.mockResolvedValue(habits);

        const handler = routes.find((r) => r.method === "GET" && r.path === "/habits")!.handler as any;
        const event = makeEvent({
            httpMethod: "GET",
            queryStringParameters: { categoryId: "cat-1" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetAll).toHaveBeenCalledWith("user-1", "cat-1");
    });

    it("GET /habits/{id} - returns habit by id", async () => {
        const habit = { id: "habit-1" };
        mockGetById.mockResolvedValue(habit);

        const handler = routes.find((r) => r.method === "GET" && r.path === "/habits/{id}")!.handler as any;
        const event = makeEvent({
            httpMethod: "GET",
            pathParameters: { id: "habit-1" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetById).toHaveBeenCalledWith("user-1", "habit-1");
    });

    it("DELETE /habits/{id} - deletes a habit", async () => {
        mockDelete.mockResolvedValue(undefined);

        const handler = routes.find((r) => r.method === "DELETE")!.handler as any;
        const event = makeEvent({
            httpMethod: "DELETE",
            pathParameters: { id: "habit-1" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.message).toBe("Habit deleted successfully");
        expect(mockDelete).toHaveBeenCalledWith("user-1", "habit-1");
    });
});
