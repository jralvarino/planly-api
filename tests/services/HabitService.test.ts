import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError } from "@arj/common-utils-layer/error";
import type { Habit } from "../../src/models/Habit.js";

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

vi.mock("../../src/repositories/HabitRepository.js", () => ({
    HabitRepository: vi.fn(),
}));

vi.mock("../../src/repositories/TodoRepository.js", () => ({
    TodoRepository: vi.fn(),
}));

vi.mock("../../src/services/StatsService.js", () => ({
    StatsService: vi.fn(),
}));

// HabitService imports isValidForTargetDate from TodoService — mock TodoService
// to avoid transitive DynamoDB/repository imports, but re-export the real function
vi.mock("../../src/services/TodoService.js", () => ({
    TodoService: vi.fn(),
    isValidForTargetDate: (habit: Habit, date: Date): boolean => {
        const targetDate = date.toISOString().split("T")[0];
        if (habit.end_date) {
            const endDate = habit.end_date.split("T")[0];
            if (targetDate > endDate) return false;
        }
        switch (habit.period_type) {
            case "every_day":
                return true;
            case "specific_days_week": {
                if (!habit.period_value) return false;
                const DOW: Record<string, number> = {
                    SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6,
                };
                const allowed = habit.period_value
                    .split(",")
                    .map((d) => DOW[d.trim().toUpperCase()])
                    .filter((d) => d !== undefined);
                return allowed.includes(date.getDay());
            }
            case "specific_days_month": {
                if (!habit.period_value) return false;
                const allowed = habit.period_value.split(",").map((d) => parseInt(d.trim()));
                return allowed.includes(date.getDate());
            }
            default:
                return false;
        }
    },
}));

const mockCreateStats = vi.fn();
const mockRecalculateOnCreated = vi.fn();
const mockRecalculateOnEdited = vi.fn();
const mockDeleteHabitStats = vi.fn();
const mockRecalculateOnDeleted = vi.fn();

vi.mock("../../src/container.js", () => ({
    container: {
        resolve: vi.fn(() => ({
            createStats: mockCreateStats,
            recalculateStatsOnHabitCreated: mockRecalculateOnCreated,
            recalculateStatsOnHabitEdited: mockRecalculateOnEdited,
            deleteHabitStats: mockDeleteHabitStats,
            recalculateStatsOnHabitDeleted: mockRecalculateOnDeleted,
        })),
    },
}));

vi.mock("uuid", () => ({ v4: () => "habit-uuid" }));

vi.mock("../../src/utils/util.js", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../../src/utils/util.js")>();
    return { ...actual, todayISO: vi.fn(() => "2024-06-15") };
});

import { HabitService } from "../../src/services/HabitService.js";

const mockHabitFindById = vi.fn();
const mockHabitFindAllByUserId = vi.fn();
const mockHabitCreate = vi.fn();
const mockHabitUpdate = vi.fn();
const mockHabitDelete = vi.fn();
const mockHabitAppendTargetChange = vi.fn();
const mockTodoFindAllByUserIdAndHabitId = vi.fn();
const mockTodoDelete = vi.fn();

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

describe("HabitService", () => {
    let service: HabitService;

    beforeEach(() => {
        vi.clearAllMocks();
        mockCreateStats.mockResolvedValue(undefined);
        mockRecalculateOnCreated.mockResolvedValue(undefined);
        mockRecalculateOnEdited.mockResolvedValue(undefined);
        mockDeleteHabitStats.mockResolvedValue(undefined);
        mockRecalculateOnDeleted.mockResolvedValue(undefined);

        service = new HabitService(
            {
                findById: mockHabitFindById,
                findAllByUserId: mockHabitFindAllByUserId,
                create: mockHabitCreate,
                update: mockHabitUpdate,
                delete: mockHabitDelete,
                appendTargetChange: mockHabitAppendTargetChange,
            } as any,
            {
                findAllByUserIdAndHabitId: mockTodoFindAllByUserIdAndHabitId,
                delete: mockTodoDelete,
            } as any
        );
    });

    describe("create", () => {
        it("creates habit with defaults and calls stats service", async () => {
            mockHabitCreate.mockResolvedValue(undefined);

            const result = await service.create("user-1", { title: "Exercise", start_date: "2024-06-10" });

            expect(result.id).toBe("habit-uuid");
            expect(result.userId).toBe("user-1");
            expect(result.title).toBe("Exercise");
            expect(result.color).toBe("#000000");
            expect(result.active).toBe(true);
            expect(mockHabitCreate).toHaveBeenCalled();
            expect(mockCreateStats).toHaveBeenCalledWith("user-1", "habit-uuid", expect.any(String));
            expect(mockRecalculateOnCreated).toHaveBeenCalled();
        });

        it("recalculates stats when start_date is today or past", async () => {
            mockHabitCreate.mockResolvedValue(undefined);

            await service.create("user-1", { title: "Past habit", start_date: "2024-01-01" });

            expect(mockRecalculateOnCreated).toHaveBeenCalled();
        });

        it("does not recalculate stats when start_date is in the future", async () => {
            mockHabitCreate.mockResolvedValue(undefined);

            await service.create("user-1", { title: "Future habit", start_date: "2099-12-31" });

            expect(mockCreateStats).toHaveBeenCalled();
            expect(mockRecalculateOnCreated).not.toHaveBeenCalled();
        });

        it("uses provided targetChanges when given", async () => {
            mockHabitCreate.mockResolvedValue(undefined);

            const result = await service.create("user-1", {
                title: "Habit",
                start_date: "2024-06-10",
                targetChanges: [{ date: "2024-06-10", value: 5 }],
            } as Partial<Habit>);

            expect(result.targetChanges).toEqual([{ date: "2024-06-10", value: 5 }]);
        });

        it("sets default targetChanges when none provided", async () => {
            mockHabitCreate.mockResolvedValue(undefined);

            const result = await service.create("user-1", { title: "Habit", start_date: "2024-06-10" });

            expect(result.targetChanges).toBeDefined();
            expect(result.targetChanges!.length).toBe(1);
            expect(result.targetChanges![0].value).toBe(1);
        });

        it("applies habitData fields as overrides", async () => {
            mockHabitCreate.mockResolvedValue(undefined);

            const result = await service.create("user-1", {
                title: "My Habit",
                color: "#FF0000",
                emoji: "🏃",
                period_type: "specific_days_week",
                period_value: "MON,WED",
                categoryId: "cat-42",
                start_date: "2024-06-01",
            });

            expect(result.color).toBe("#FF0000");
            expect(result.emoji).toBe("🏃");
            expect(result.period_type).toBe("specific_days_week");
            expect(result.categoryId).toBe("cat-42");
        });
    });

    describe("getAllHabits", () => {
        it("returns all habits for user", async () => {
            mockHabitFindAllByUserId.mockResolvedValue([baseHabit]);

            const result = await service.getAllHabits("user-1");

            expect(result).toHaveLength(1);
            expect(result[0]).toEqual(baseHabit);
        });

        it("filters by categoryId when provided", async () => {
            const habit2: Habit = { ...baseHabit, id: "habit-2", categoryId: "cat2" };
            mockHabitFindAllByUserId.mockResolvedValue([baseHabit, habit2]);

            const result = await service.getAllHabits("user-1", "cat1");

            expect(result).toHaveLength(1);
            expect(result[0].categoryId).toBe("cat1");
        });

        it("returns empty array when user has no habits", async () => {
            mockHabitFindAllByUserId.mockResolvedValue([]);

            const result = await service.getAllHabits("user-1");

            expect(result).toEqual([]);
        });
    });

    describe("getHabitById", () => {
        it("returns habit when found and userId matches", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);

            const result = await service.getHabitById("user-1", "habit-1");

            expect(result).toEqual(baseHabit);
        });

        it("throws NotFoundError when habit does not exist", async () => {
            mockHabitFindById.mockResolvedValue(null);

            await expect(service.getHabitById("user-1", "habit-1")).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError when habit belongs to different user", async () => {
            mockHabitFindById.mockResolvedValue({ ...baseHabit, userId: "other-user" });

            await expect(service.getHabitById("user-1", "habit-1")).rejects.toThrow(NotFoundError);
        });
    });

    describe("update", () => {
        it("throws NotFoundError when habit does not exist", async () => {
            mockHabitFindById.mockResolvedValue(null);

            await expect(service.update("user-1", "habit-1", { title: "New" })).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError when habit belongs to different user", async () => {
            mockHabitFindById.mockResolvedValue({ ...baseHabit, userId: "other-user" });

            await expect(service.update("user-1", "habit-1", { title: "New" })).rejects.toThrow(NotFoundError);
        });

        it("updates habit and returns merged result", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockHabitUpdate.mockResolvedValue(undefined);

            const result = await service.update("user-1", "habit-1", { title: "New Title" });

            expect(result.title).toBe("New Title");
            expect(result.id).toBe("habit-1");
            expect(result.userId).toBe("user-1");
            expect(mockHabitUpdate).toHaveBeenCalled();
        });

        it("preserves id and userId from existing habit", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockHabitUpdate.mockResolvedValue(undefined);

            const result = await service.update("user-1", "habit-1", {
                id: "injected-id",
                userId: "injected-user",
                title: "Changed",
            } as Partial<Habit>);

            expect(result.id).toBe("habit-1");
            expect(result.userId).toBe("user-1");
        });

        it("appends targetChange when value changes", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockHabitUpdate.mockResolvedValue(undefined);
            mockHabitAppendTargetChange.mockResolvedValue(undefined);

            await service.update("user-1", "habit-1", { value: "5" });

            expect(mockHabitAppendTargetChange).toHaveBeenCalledWith(
                "habit-1",
                expect.objectContaining({ value: 5 })
            );
        });

        it("does not append targetChange when value is unchanged", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockHabitUpdate.mockResolvedValue(undefined);

            await service.update("user-1", "habit-1", { title: "New title" });

            expect(mockHabitAppendTargetChange).not.toHaveBeenCalled();
        });

        it("handles error from appendTargetChange gracefully", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockHabitUpdate.mockResolvedValue(undefined);
            mockHabitAppendTargetChange.mockRejectedValue(new Error("DB error"));

            await expect(service.update("user-1", "habit-1", { value: "5" })).resolves.toBeDefined();
        });

        it("recalculates stats when categoryId changes", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockHabitUpdate.mockResolvedValue(undefined);

            await service.update("user-1", "habit-1", { categoryId: "cat2" });

            expect(mockRecalculateOnEdited).toHaveBeenCalledWith("user-1", "habit-1", "cat1", "cat2");
        });

        it("recalculates stats when start_date changes", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockHabitUpdate.mockResolvedValue(undefined);

            await service.update("user-1", "habit-1", { start_date: "2024-03-01" });

            expect(mockRecalculateOnEdited).toHaveBeenCalled();
        });

        it("does not recalculate stats when no stats-affecting fields change", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockHabitUpdate.mockResolvedValue(undefined);

            await service.update("user-1", "habit-1", { title: "New Title", color: "#FF0000" });

            expect(mockRecalculateOnEdited).not.toHaveBeenCalled();
        });
    });

    describe("delete", () => {
        it("throws NotFoundError when habit does not exist", async () => {
            mockHabitFindById.mockResolvedValue(null);

            await expect(service.delete("user-1", "habit-1")).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError when habit belongs to different user", async () => {
            mockHabitFindById.mockResolvedValue({ ...baseHabit, userId: "other-user" });

            await expect(service.delete("user-1", "habit-1")).rejects.toThrow(NotFoundError);
        });

        it("deletes all associated todos and the habit", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindAllByUserIdAndHabitId.mockResolvedValue([
                { date: "2024-06-10", habitId: "habit-1" },
                { date: "2024-06-11", habitId: "habit-1" },
            ]);
            mockTodoDelete.mockResolvedValue(undefined);
            mockHabitDelete.mockResolvedValue(undefined);

            await service.delete("user-1", "habit-1");

            expect(mockTodoDelete).toHaveBeenCalledTimes(2);
            expect(mockTodoDelete).toHaveBeenCalledWith("user-1", "2024-06-10", "habit-1");
            expect(mockTodoDelete).toHaveBeenCalledWith("user-1", "2024-06-11", "habit-1");
            expect(mockDeleteHabitStats).toHaveBeenCalledWith("user-1", "habit-1");
            expect(mockHabitDelete).toHaveBeenCalledWith("habit-1");
            expect(mockRecalculateOnDeleted).toHaveBeenCalledWith("user-1", "cat1");
        });

        it("deletes habit when there are no associated todos", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindAllByUserIdAndHabitId.mockResolvedValue([]);
            mockHabitDelete.mockResolvedValue(undefined);

            await service.delete("user-1", "habit-1");

            expect(mockTodoDelete).not.toHaveBeenCalled();
            expect(mockHabitDelete).toHaveBeenCalled();
        });
    });

    describe("getScheduledDates", () => {
        it("returns all dates for every_day habit", async () => {
            const result = await service.getScheduledDates(baseHabit, "2024-01-03");

            expect(result).toEqual(["2024-01-01", "2024-01-02", "2024-01-03"]);
        });

        it("returns only matching weekdays for specific_days_week", async () => {
            // 2024-01-01 is Monday
            const habit: Habit = {
                ...baseHabit,
                period_type: "specific_days_week",
                period_value: "MON",
                start_date: "2024-01-01",
            };

            const result = await service.getScheduledDates(habit, "2024-01-07");

            expect(result).toContain("2024-01-01"); // Monday
            expect(result).not.toContain("2024-01-02"); // Tuesday
            expect(result).not.toContain("2024-01-06"); // Saturday
        });

        it("returns only matching days of month", async () => {
            const habit: Habit = {
                ...baseHabit,
                period_type: "specific_days_month",
                period_value: "15",
                start_date: "2024-06-01",
            };

            const result = await service.getScheduledDates(habit, "2024-06-30");

            expect(result).toEqual(["2024-06-15"]);
        });

        it("returns empty array when no dates match", async () => {
            const habit: Habit = {
                ...baseHabit,
                period_type: "specific_days_month",
                period_value: "31",
                start_date: "2024-02-01",
            };

            // February has no day 31
            const result = await service.getScheduledDates(habit, "2024-02-29");

            expect(result).toEqual([]);
        });

        it("returns empty array when start_date is after endDate", async () => {
            const result = await service.getScheduledDates(baseHabit, "2023-12-31");

            expect(result).toEqual([]);
        });
    });
});
