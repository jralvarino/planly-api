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
            getAllCategories: mockGetAll,
            getCategoryById: mockGetById,
            delete: mockDelete,
        })),
    },
}));

import { routes } from "../../src/controllers/category.controller.js";

function makeEvent(overrides: Record<string, unknown> = {}): any {
    return {
        httpMethod: "GET",
        path: "/categories",
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

describe("category.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("POST /categories - creates a category", async () => {
        const category = { id: "cat-1", name: "Health", userId: "user-1" };
        mockCreate.mockResolvedValue(category);

        const handler = routes.find((r) => r.method === "POST")!.handler as any;
        const event = makeEvent({
            httpMethod: "POST",
            body: { name: "Health" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(201);
        const body = JSON.parse(result.body);
        expect(body.category).toEqual(category);
        expect(mockCreate).toHaveBeenCalledWith("user-1", "Health");
    });

    it("PUT /categories/{id} - updates a category", async () => {
        const category = { id: "cat-1", name: "Updated", userId: "user-1" };
        mockUpdate.mockResolvedValue(category);

        const handler = routes.find((r) => r.method === "PUT")!.handler as any;
        const event = makeEvent({
            httpMethod: "PUT",
            pathParameters: { id: "cat-1" },
            body: { name: "Updated" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.category).toEqual(category);
        expect(mockUpdate).toHaveBeenCalledWith("user-1", "cat-1", "Updated");
    });

    it("GET /categories - returns all categories", async () => {
        const categories = [{ id: "cat-1", name: "Health" }];
        mockGetAll.mockResolvedValue(categories);

        const handler = routes.find((r) => r.method === "GET" && r.path === "/categories")!.handler as any;
        const event = makeEvent({ httpMethod: "GET" });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetAll).toHaveBeenCalledWith("user-1");
    });

    it("GET /categories/{id} - returns category by id", async () => {
        const category = { id: "cat-1", name: "Health" };
        mockGetById.mockResolvedValue(category);

        const handler = routes.find((r) => r.method === "GET" && r.path === "/categories/{id}")!.handler as any;
        const event = makeEvent({
            httpMethod: "GET",
            pathParameters: { id: "cat-1" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetById).toHaveBeenCalledWith("user-1", "cat-1");
    });

    it("DELETE /categories/{id} - deletes a category", async () => {
        mockDelete.mockResolvedValue(undefined);

        const handler = routes.find((r) => r.method === "DELETE")!.handler as any;
        const event = makeEvent({
            httpMethod: "DELETE",
            pathParameters: { id: "cat-1" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockDelete).toHaveBeenCalledWith("user-1", "cat-1");
    });
});
