import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

vi.mock("@arj/common-utils-layer/db", () => ({
    ddb: { send: mockSend },
}));

import { HabitRepository } from "../../src/repositories/HabitRepository.js";
import type { Habit } from "../../src/models/Habit.js";

const baseHabit: Habit = {
    id: "habit-1",
    userId: "user-1",
    title: "Exercise",
    color: "#fff",
    emoji: "💪",
    unit: "count",
    value: "1",
    period_type: "every_day",
    period_value: "",
    categoryId: "cat1",
    period: "Anytime",
    reminder_enabled: false,
    start_date: "2024-01-01",
    active: true,
    createdAt: "2024-01-01T00:00:00Z",
    updatedAt: "2024-01-01T00:00:00Z",
};

describe("HabitRepository", () => {
    let repo: HabitRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new HabitRepository();
    });

    describe("create", () => {
        it("calls ddb.send with PutCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.create(baseHabit);
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("update", () => {
        it("calls ddb.send with PutCommand including updatedAt", async () => {
            mockSend.mockResolvedValue({});
            await repo.update(baseHabit);
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("findById", () => {
        it("returns habit when found", async () => {
            mockSend.mockResolvedValue({ Item: baseHabit });
            const result = await repo.findById("habit-1");
            expect(result).toEqual(baseHabit);
        });

        it("returns null when not found", async () => {
            mockSend.mockResolvedValue({ Item: undefined });
            const result = await repo.findById("not-found");
            expect(result).toBeNull();
        });
    });

    describe("findAllByUserId", () => {
        it("returns all habits for user", async () => {
            mockSend.mockResolvedValue({ Items: [baseHabit] });
            const result = await repo.findAllByUserId("user-1");
            expect(result).toEqual([baseHabit]);
        });

        it("returns empty array when no habits", async () => {
            mockSend.mockResolvedValue({ Items: undefined });
            const result = await repo.findAllByUserId("user-1");
            expect(result).toEqual([]);
        });
    });

    describe("findAllByDate", () => {
        it("returns habits active on given date", async () => {
            mockSend.mockResolvedValue({ Items: [baseHabit] });
            const result = await repo.findAllByDate("user-1", "2024-06-15");
            expect(result).toEqual([baseHabit]);
        });

        it("returns empty array when no habits", async () => {
            mockSend.mockResolvedValue({ Items: undefined });
            const result = await repo.findAllByDate("user-1", "2024-06-15");
            expect(result).toEqual([]);
        });
    });

    describe("delete", () => {
        it("calls ddb.send with DeleteCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.delete("habit-1");
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("findAll", () => {
        it("returns all habits without pagination", async () => {
            mockSend.mockResolvedValue({ Items: [baseHabit], LastEvaluatedKey: undefined });
            const result = await repo.findAll();
            expect(result).toEqual([baseHabit]);
            expect(mockSend).toHaveBeenCalledOnce();
        });

        it("paginates through multiple pages", async () => {
            const habit2: Habit = { ...baseHabit, id: "habit-2" };
            mockSend
                .mockResolvedValueOnce({ Items: [baseHabit], LastEvaluatedKey: { id: "habit-1" } })
                .mockResolvedValueOnce({ Items: [habit2], LastEvaluatedKey: undefined });

            const result = await repo.findAll();

            expect(result).toHaveLength(2);
            expect(mockSend).toHaveBeenCalledTimes(2);
        });

        it("returns empty array when no habits exist", async () => {
            mockSend.mockResolvedValue({ Items: undefined, LastEvaluatedKey: undefined });
            const result = await repo.findAll();
            expect(result).toEqual([]);
        });
    });

    describe("appendTargetChange", () => {
        it("calls ddb.send with UpdateCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.appendTargetChange("habit-1", { date: "2024-06-15T00:00:00Z", value: 5 });
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });
});
