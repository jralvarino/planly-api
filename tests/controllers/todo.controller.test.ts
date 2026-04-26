import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCreateOrUpdate, mockGetTodoListByDate, mockGetDailySummary, mockUpdateNotes } = vi.hoisted(() => ({
    mockCreateOrUpdate: vi.fn(),
    mockGetTodoListByDate: vi.fn(),
    mockGetDailySummary: vi.fn(),
    mockUpdateNotes: vi.fn(),
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
            createOrUpdate: mockCreateOrUpdate,
            getTodoListByDate: mockGetTodoListByDate,
            getDailySummary: mockGetDailySummary,
            updateNotes: mockUpdateNotes,
        })),
    },
}));

import { routes } from "../../src/controllers/todo.controller.js";

function makeEvent(overrides: Record<string, unknown> = {}): any {
    return {
        httpMethod: "GET",
        path: "/todo",
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

describe("todo.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("GET /todo/date - returns todo list by date", async () => {
        const todos = [{ habitId: "h1" }];
        mockGetTodoListByDate.mockResolvedValue(todos);

        const handler = routes.find((r) => r.path === "/todo/date")!.handler as any;
        const event = makeEvent({
            httpMethod: "GET",
            queryStringParameters: { date: "2024-06-15" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetTodoListByDate).toHaveBeenCalledWith("user-1", "2024-06-15");
    });

    it("GET /todo/date - uses empty string when no date param", async () => {
        mockGetTodoListByDate.mockResolvedValue([]);

        const handler = routes.find((r) => r.path === "/todo/date")!.handler as any;
        const event = makeEvent({ httpMethod: "GET" });

        await handler(event, {});

        expect(mockGetTodoListByDate).toHaveBeenCalledWith("user-1", "");
    });

    it("GET /todo/summary - returns daily summary", async () => {
        const summary = [{ date: "2024-06-15", completions: 3, total: 5 }];
        mockGetDailySummary.mockResolvedValue(summary);

        const handler = routes.find((r) => r.path === "/todo/summary")!.handler as any;
        const event = makeEvent({
            httpMethod: "GET",
            queryStringParameters: { startDate: "2024-06-01", endDate: "2024-06-30" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetDailySummary).toHaveBeenCalledWith("user-1", "2024-06-01", "2024-06-30");
    });

    it("GET /todo/summary - throws BadRequestError when dates missing", async () => {
        const handler = routes.find((r) => r.path === "/todo/summary")!.handler as any;
        const event = makeEvent({ httpMethod: "GET" });

        await expect(handler(event, {})).rejects.toThrow("startDate and endDate query parameters are required");
    });

    it("PATCH /todo/{habitId} - creates or updates todo", async () => {
        mockCreateOrUpdate.mockResolvedValue(undefined);

        const handler = routes.find((r) => r.path === "/todo/{habitId}" && r.method === "PATCH")!.handler as any;
        const body = { date: "2024-06-15", status: "done" };
        const event = makeEvent({
            httpMethod: "PATCH",
            pathParameters: { habitId: "h1" },
            body: body,
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(204);
        expect(mockCreateOrUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: "user-1",
                habitId: "h1",
                date: "2024-06-15",
                status: "done",
            })
        );
    });

    it("PATCH /todo/{habitId}/notes - updates todo notes", async () => {
        mockUpdateNotes.mockResolvedValue(undefined);

        const handler = routes.find((r) => r.path === "/todo/{habitId}/notes")!.handler as any;
        const body = { date: "2024-06-15", notes: "Felt great today" };
        const event = makeEvent({
            httpMethod: "PATCH",
            pathParameters: { habitId: "h1" },
            body: body,
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(204);
        expect(mockUpdateNotes).toHaveBeenCalledWith("user-1", "h1", "2024-06-15", "Felt great today");
    });
});
