import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetGlobalStreak, mockGetDashboardData } = vi.hoisted(() => ({
    mockGetGlobalStreak: vi.fn(),
    mockGetDashboardData: vi.fn(),
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
            getGlobalStreak: mockGetGlobalStreak,
            getDashboardData: mockGetDashboardData,
        })),
    },
}));

import { routes } from "../../src/controllers/stats.controller.js";

function makeEvent(overrides: Record<string, unknown> = {}): any {
    return {
        httpMethod: "GET",
        path: "/stats",
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

describe("stats.controller", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("GET /stats/globalStreak - returns current streak", async () => {
        mockGetGlobalStreak.mockResolvedValue(7);

        const handler = routes.find((r) => r.path === "/stats/globalStreak")!.handler as any;
        const event = makeEvent({ httpMethod: "GET" });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        const body = JSON.parse(result.body);
        expect(body.currentStreak).toBe(7);
        expect(mockGetGlobalStreak).toHaveBeenCalledWith("user-1");
    });

    it("GET /stats/dashboard - returns dashboard data", async () => {
        const data = { habits: [], completions: [] };
        mockGetDashboardData.mockResolvedValue(data);

        const handler = routes.find((r) => r.path === "/stats/dashboard")!.handler as any;
        const event = makeEvent({
            httpMethod: "GET",
            queryStringParameters: { month: "2024-06" },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetDashboardData).toHaveBeenCalledWith("user-1", "2024-06", undefined, undefined, undefined);
    });

    it("GET /stats/dashboard - passes optional params", async () => {
        const data = { habits: [] };
        mockGetDashboardData.mockResolvedValue(data);

        const handler = routes.find((r) => r.path === "/stats/dashboard")!.handler as any;
        const event = makeEvent({
            httpMethod: "GET",
            queryStringParameters: {
                month: "2024-06",
                categoryId: "cat-1",
                habitId: "h1",
                selectedDate: "2024-06-15",
            },
        });

        const result = await handler(event, {});

        expect(result.statusCode).toBe(200);
        expect(mockGetDashboardData).toHaveBeenCalledWith("user-1", "2024-06", "cat-1", "h1", "2024-06-15");
    });
});
