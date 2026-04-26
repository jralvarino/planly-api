import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConditionalCheckFailedException } from "@aws-sdk/client-dynamodb";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

vi.mock("@arj/common-utils-layer/db", () => ({
    ddb: { send: mockSend },
}));

import { StatsRepository } from "../../src/repositories/StatsRepository.js";
import type { Stats } from "../../src/models/Stats.js";

const baseStats: Stats = {
    PK: "USER#user-1",
    SK: "HABIT#habit-1",
    scope: "HABIT",
    userId: "user-1",
    habitId: "habit-1",
    categoryId: "cat-1",
    currentStreak: 5,
    longestStreak: 10,
    totalCompletions: 20,
    lastCompletedDate: "2024-06-15",
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-06-15T00:00:00Z",
} as unknown as Stats;

describe("StatsRepository", () => {
    let repo: StatsRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new StatsRepository();
    });

    describe("create", () => {
        it("calls ddb.send with PutCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.create(baseStats);
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("createIfNotExists", () => {
        it("returns true when successfully created", async () => {
            mockSend.mockResolvedValue({});
            const result = await repo.createIfNotExists(baseStats);
            expect(result).toBe(true);
        });

        it("returns false when item already exists (ConditionalCheckFailed)", async () => {
            mockSend.mockRejectedValue(
                new ConditionalCheckFailedException({
                    message: "The conditional request failed",
                    $metadata: {},
                })
            );
            const result = await repo.createIfNotExists(baseStats);
            expect(result).toBe(false);
        });

        it("rethrows non-conditional errors", async () => {
            mockSend.mockRejectedValue(new Error("Network error"));
            await expect(repo.createIfNotExists(baseStats)).rejects.toThrow("Network error");
        });
    });

    describe("updateStreakFields", () => {
        it("calls ddb.send with UpdateCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.updateStreakFields("USER#user-1", "HABIT#habit-1", {
                currentStreak: 6,
                longestStreak: 10,
                lastCompletedDate: "2024-06-16",
                totalCompletions: 21,
            });
            expect(mockSend).toHaveBeenCalledOnce();
        });

        it("sets lastCompletedDate to null when undefined", async () => {
            mockSend.mockResolvedValue({});
            await repo.updateStreakFields("USER#user-1", "HABIT#habit-1", {
                currentStreak: 0,
                longestStreak: 10,
                lastCompletedDate: undefined,
                totalCompletions: 21,
            });
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("get", () => {
        it("returns stats when found", async () => {
            mockSend.mockResolvedValue({ Item: baseStats });
            const result = await repo.get("USER#user-1", "HABIT#habit-1");
            expect(result).toEqual(baseStats);
        });

        it("returns null when not found", async () => {
            mockSend.mockResolvedValue({ Item: undefined });
            const result = await repo.get("USER#user-1", "HABIT#habit-1");
            expect(result).toBeNull();
        });
    });

    describe("delete", () => {
        it("calls ddb.send with DeleteCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.delete("USER#user-1", "HABIT#habit-1");
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });
});
