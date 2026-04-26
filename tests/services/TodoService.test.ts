import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NotFoundError } from "@arj/common-utils-layer/error";
import { TODO_STATUS } from "../../src/constants/todo.constants.js";
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

import { TodoService, isValidForTargetDate } from "../../src/services/TodoService.js";

const mockHabitFindById = vi.fn();
const mockHabitFindAllByDate = vi.fn();
const mockTodoFindByUserDateAndHabit = vi.fn();
const mockTodoCreateOrUpdate = vi.fn();
const mockTodoUpdateNotes = vi.fn();
const mockStatsUpdateStats = vi.fn();
const mockStatsGetHabitStats = vi.fn();

const baseHabit: Habit = {
    id: "h1",
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
    targetChanges: [{ date: "2024-01-01T00:00:00Z", value: 1 }],
};

describe("isValidForTargetDate", () => {
    it("returns true for every_day habit", () => {
        const date = new Date("2024-06-15T12:00:00.000Z");
        expect(isValidForTargetDate(baseHabit, date)).toBe(true);
    });

    it("returns false when target date is past end_date", () => {
        const habit = { ...baseHabit, end_date: "2024-06-14T23:59:59Z" };
        const date = new Date("2024-06-15T00:00:00.000Z");
        expect(isValidForTargetDate(habit, date)).toBe(false);
    });

    it("returns true when target date equals end_date", () => {
        const habit = { ...baseHabit, end_date: "2024-06-15T00:00:00.000Z" };
        const date = new Date("2024-06-15T00:00:00.000Z");
        expect(isValidForTargetDate(habit, date)).toBe(true);
    });

    describe("specific_days_week", () => {
        it("returns true when weekday is in allowed days", () => {
            const habit = { ...baseHabit, period_type: "specific_days_week" as const, period_value: "MON,WED,FRI" };
            const monday = new Date("2024-06-17T12:00:00.000Z");
            expect(isValidForTargetDate(habit, monday)).toBe(true);
        });

        it("returns false when weekday is not in allowed days", () => {
            const habit = { ...baseHabit, period_type: "specific_days_week" as const, period_value: "MON,WED,FRI" };
            const tuesday = new Date("2024-06-18T12:00:00.000Z");
            expect(isValidForTargetDate(habit, tuesday)).toBe(false);
        });

        it("returns false when period_value is empty", () => {
            const habit = { ...baseHabit, period_type: "specific_days_week" as const, period_value: "" };
            const date = new Date("2024-06-17T12:00:00.000Z");
            expect(isValidForTargetDate(habit, date)).toBe(false);
        });

        it("handles lowercase day abbreviations in period_value", () => {
            const habit = { ...baseHabit, period_type: "specific_days_week" as const, period_value: "mon,fri" };
            const monday = new Date("2024-06-17T12:00:00.000Z");
            expect(isValidForTargetDate(habit, monday)).toBe(true);
        });
    });

    describe("specific_days_month", () => {
        it("returns true when day of month matches", () => {
            const habit = { ...baseHabit, period_type: "specific_days_month" as const, period_value: "1,15,31" };
            const fifteenth = new Date("2024-06-15T12:00:00.000Z");
            expect(isValidForTargetDate(habit, fifteenth)).toBe(true);
        });

        it("returns false when day of month does not match", () => {
            const habit = { ...baseHabit, period_type: "specific_days_month" as const, period_value: "1,15,31" };
            const tenth = new Date("2024-06-10T12:00:00.000Z");
            expect(isValidForTargetDate(habit, tenth)).toBe(false);
        });

        it("returns false when period_value is empty", () => {
            const habit = { ...baseHabit, period_type: "specific_days_month" as const, period_value: "" };
            const date = new Date("2024-06-15T12:00:00.000Z");
            expect(isValidForTargetDate(habit, date)).toBe(false);
        });
    });

    it("returns false for unknown period_type", () => {
        const habit = { ...baseHabit, period_type: "unknown_type" as any };
        const date = new Date("2024-06-15T12:00:00.000Z");
        expect(isValidForTargetDate(habit, date)).toBe(false);
    });
});

describe("TodoService", () => {
    let service: TodoService;

    beforeEach(() => {
        vi.clearAllMocks();
        service = new TodoService(
            {
                findById: mockHabitFindById,
                findAllByDate: mockHabitFindAllByDate,
            } as any,
            {
                findByUserDateAndHabit: mockTodoFindByUserDateAndHabit,
                createOrUpdate: mockTodoCreateOrUpdate,
                updateNotes: mockTodoUpdateNotes,
            } as any,
            {
                updateStatsOnTodoStatusChange: mockStatsUpdateStats,
                getHabitStats: mockStatsGetHabitStats,
            } as any
        );
    });

    describe("createOrUpdate", () => {
        it("throws NotFoundError when habit does not exist", async () => {
            mockHabitFindById.mockResolvedValue(null);

            await expect(
                service.createOrUpdate({ userId: "user-1", habitId: "h1", date: "2024-06-15", status: TODO_STATUS.DONE })
            ).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError when habit belongs to different user", async () => {
            mockHabitFindById.mockResolvedValue({ ...baseHabit, userId: "other-user" });

            await expect(
                service.createOrUpdate({ userId: "user-1", habitId: "h1", date: "2024-06-15", status: TODO_STATUS.DONE })
            ).rejects.toThrow(NotFoundError);
        });

        it("creates new todo with DONE status and sets progress to target", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockTodoCreateOrUpdate.mockResolvedValue(undefined);
            mockStatsUpdateStats.mockResolvedValue(undefined);

            const result = await service.createOrUpdate({
                userId: "user-1",
                habitId: "h1",
                date: "2024-06-15",
                status: TODO_STATUS.DONE,
            });

            expect(result.status).toBe(TODO_STATUS.DONE);
            expect(result.progress).toBe(1);
            expect(result.completedAt).toBeDefined();
            expect(mockTodoCreateOrUpdate).toHaveBeenCalled();
            expect(mockStatsUpdateStats).toHaveBeenCalled();
        });

        it("sets progress to 0 when changing from DONE to PENDING", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue({
                status: TODO_STATUS.DONE,
                progress: 1,
                notes: "",
                createdAt: "2024-01-01T00:00:00Z",
            });
            mockTodoCreateOrUpdate.mockResolvedValue(undefined);
            mockStatsUpdateStats.mockResolvedValue(undefined);

            const result = await service.createOrUpdate({
                userId: "user-1",
                habitId: "h1",
                date: "2024-06-15",
                status: TODO_STATUS.PENDING,
            });

            expect(result.progress).toBe(0);
        });

        it("sets progress to 0 for SKIPPED status", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockTodoCreateOrUpdate.mockResolvedValue(undefined);
            mockStatsUpdateStats.mockResolvedValue(undefined);

            const result = await service.createOrUpdate({
                userId: "user-1",
                habitId: "h1",
                date: "2024-06-15",
                status: TODO_STATUS.SKIPPED,
            });

            expect(result.progress).toBe(0);
        });

        it("uses progressValue when provided for PENDING status", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockTodoCreateOrUpdate.mockResolvedValue(undefined);
            mockStatsUpdateStats.mockResolvedValue(undefined);

            const result = await service.createOrUpdate({
                userId: "user-1",
                habitId: "h1",
                date: "2024-06-15",
                status: TODO_STATUS.PENDING,
                progressValue: 5,
            });

            expect(result.progress).toBe(5);
        });

        it("sets completedAt only when status is DONE", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockTodoCreateOrUpdate.mockResolvedValue(undefined);
            mockStatsUpdateStats.mockResolvedValue(undefined);

            const pending = await service.createOrUpdate({
                userId: "user-1",
                habitId: "h1",
                date: "2024-06-15",
                status: TODO_STATUS.PENDING,
            });

            expect(pending.completedAt).toBeUndefined();
        });

        it("carries over notes from existing todo", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue({
                status: TODO_STATUS.PENDING,
                progress: 0,
                notes: "important note",
                createdAt: "2024-01-01T00:00:00Z",
            });
            mockTodoCreateOrUpdate.mockResolvedValue(undefined);
            mockStatsUpdateStats.mockResolvedValue(undefined);

            const result = await service.createOrUpdate({
                userId: "user-1",
                habitId: "h1",
                date: "2024-06-15",
                status: TODO_STATUS.DONE,
            });

            expect(result.notes).toBe("important note");
        });

        it("uses previousStatus PENDING when no existing todo", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockTodoCreateOrUpdate.mockResolvedValue(undefined);
            mockStatsUpdateStats.mockResolvedValue(undefined);

            await service.createOrUpdate({
                userId: "user-1",
                habitId: "h1",
                date: "2024-06-15",
                status: TODO_STATUS.DONE,
            });

            expect(mockStatsUpdateStats).toHaveBeenCalledWith(
                expect.objectContaining({ previousStatus: TODO_STATUS.PENDING })
            );
        });
    });

    describe("getTodoListByDate", () => {
        it("returns empty array when no habits found", async () => {
            mockHabitFindAllByDate.mockResolvedValue([]);

            const result = await service.getTodoListByDate("user-1", "2024-06-15");

            expect(result).toEqual([]);
        });

        it("returns todo list for eligible habits", async () => {
            mockHabitFindAllByDate.mockResolvedValue([baseHabit]);
            mockTodoFindByUserDateAndHabit.mockResolvedValue({
                status: TODO_STATUS.DONE,
                progress: 1,
                notes: "done!",
                completedAt: "2024-06-15T10:00:00Z",
                updatedAt: "2024-06-15T10:00:00Z",
            });
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 7 });

            const result = await service.getTodoListByDate("user-1", "2024-06-15");

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("h1");
            expect(result[0].status).toBe(TODO_STATUS.DONE);
            expect(result[0].streak).toBe(7);
        });

        it("returns PENDING status and streak 0 when no todo exists", async () => {
            mockHabitFindAllByDate.mockResolvedValue([baseHabit]);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 0 });

            const result = await service.getTodoListByDate("user-1", "2024-06-15");

            expect(result[0].status).toBe(TODO_STATUS.PENDING);
            expect(result[0].progressValue).toBe("0");
            expect(result[0].notes).toBe("");
        });

        it("filters habits by categoryId", async () => {
            const habit2 = { ...baseHabit, id: "h2", categoryId: "cat2" };
            mockHabitFindAllByDate.mockResolvedValue([baseHabit, habit2]);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 0 });

            const result = await service.getTodoListByDate("user-1", "2024-06-15", "cat1");

            expect(result).toHaveLength(1);
            expect(result[0].categoryId).toBe("cat1");
        });

        it("filters habits by habitId", async () => {
            const habit2 = { ...baseHabit, id: "h2" };
            mockHabitFindAllByDate.mockResolvedValue([baseHabit, habit2]);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 0 });

            const result = await service.getTodoListByDate("user-1", "2024-06-15", undefined, "h1");

            expect(result).toHaveLength(1);
            expect(result[0].id).toBe("h1");
        });

        it("excludes habits with period_type specific_days_week on wrong day", async () => {
            const tuesdayOnlyHabit: Habit = {
                ...baseHabit,
                period_type: "specific_days_week",
                period_value: "TUE",
            };
            mockHabitFindAllByDate.mockResolvedValue([tuesdayOnlyHabit]);

            // 2024-06-15 is a Saturday
            const result = await service.getTodoListByDate("user-1", "2024-06-15");

            expect(result).toHaveLength(0);
        });

        it("sorts by status order: PENDING before DONE", async () => {
            const habit1 = { ...baseHabit, id: "h1" };
            const habit2 = { ...baseHabit, id: "h2" };
            mockHabitFindAllByDate.mockResolvedValue([habit2, habit1]);
            mockTodoFindByUserDateAndHabit
                .mockResolvedValueOnce({
                    status: TODO_STATUS.DONE,
                    completedAt: "2024-06-15T12:00:00Z",
                    progress: 1,
                    notes: "",
                    updatedAt: "",
                })
                .mockResolvedValueOnce({
                    status: TODO_STATUS.PENDING,
                    progress: 0,
                    notes: "",
                    updatedAt: "",
                });
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 0 });

            const result = await service.getTodoListByDate("user-1", "2024-06-15");

            expect(result[0].status).toBe(TODO_STATUS.PENDING);
            expect(result[1].status).toBe(TODO_STATUS.DONE);
        });

        it("sorts DONE todos by completedAt", async () => {
            const habit1 = { ...baseHabit, id: "h1" };
            const habit2 = { ...baseHabit, id: "h2" };
            mockHabitFindAllByDate.mockResolvedValue([habit1, habit2]);
            mockTodoFindByUserDateAndHabit
                .mockResolvedValueOnce({
                    status: TODO_STATUS.DONE,
                    completedAt: "2024-06-15T14:00:00Z",
                    progress: 1,
                    notes: "",
                    updatedAt: "",
                })
                .mockResolvedValueOnce({
                    status: TODO_STATUS.DONE,
                    completedAt: "2024-06-15T10:00:00Z",
                    progress: 1,
                    notes: "",
                    updatedAt: "",
                });
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 0 });

            const result = await service.getTodoListByDate("user-1", "2024-06-15");

            expect(result[0].completedAt).toBe("2024-06-15T10:00:00Z");
            expect(result[1].completedAt).toBe("2024-06-15T14:00:00Z");
        });

        it("sorts PENDING todos by period", async () => {
            const morningHabit = { ...baseHabit, id: "h1", period: "Morning" as const };
            const anytimeHabit = { ...baseHabit, id: "h2", period: "Anytime" as const };
            mockHabitFindAllByDate.mockResolvedValue([anytimeHabit, morningHabit]);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 0 });

            const result = await service.getTodoListByDate("user-1", "2024-06-15");

            expect(result[0].id).toBe("h1"); // Morning first
            expect(result[1].id).toBe("h2"); // Anytime last
        });
    });

    describe("getDailySummary", () => {
        it("returns stats for each date in range", async () => {
            mockHabitFindAllByDate.mockResolvedValue([baseHabit]);
            mockTodoFindByUserDateAndHabit.mockResolvedValue({
                status: TODO_STATUS.DONE,
                progress: 1,
                notes: "",
                completedAt: "2024-06-15T10:00:00Z",
                updatedAt: "",
            });
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 1 });

            const result = await service.getDailySummary("user-1", "2024-06-15", "2024-06-16");

            expect(result).toHaveLength(2);
            expect(result[0].date).toBe("2024-06-15");
            expect(result[1].date).toBe("2024-06-16");
        });

        it("includes done/skipped/pending totals", async () => {
            const habit2 = { ...baseHabit, id: "h2" };
            mockHabitFindAllByDate.mockResolvedValue([baseHabit, habit2]);
            mockTodoFindByUserDateAndHabit
                .mockResolvedValueOnce({ status: TODO_STATUS.DONE, progress: 1, notes: "", completedAt: "t", updatedAt: "" })
                .mockResolvedValueOnce({ status: TODO_STATUS.SKIPPED, progress: 0, notes: "", updatedAt: "" });
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 0 });

            const result = await service.getDailySummary("user-1", "2024-06-15", "2024-06-15");

            expect(result[0].total.done).toBe(1);
            expect(result[0].total.skipped).toBe(1);
            expect(result[0].total.pending).toBe(0);
            expect(result[0].total.total).toBe(2);
        });

        it("groups todos by category", async () => {
            const habit2: Habit = { ...baseHabit, id: "h2", categoryId: "cat2" };
            mockHabitFindAllByDate.mockResolvedValue([baseHabit, habit2]);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockStatsGetHabitStats.mockResolvedValue({ currentStreak: 0 });

            const result = await service.getDailySummary("user-1", "2024-06-15", "2024-06-15");

            expect(result[0].categories).toHaveLength(2);
        });
    });

    describe("updateNotes", () => {
        it("throws NotFoundError when habit does not exist", async () => {
            mockHabitFindById.mockResolvedValue(null);

            await expect(service.updateNotes("user-1", "h1", "2024-06-15", "note")).rejects.toThrow(NotFoundError);
        });

        it("throws NotFoundError when habit belongs to different user", async () => {
            mockHabitFindById.mockResolvedValue({ ...baseHabit, userId: "other-user" });

            await expect(service.updateNotes("user-1", "h1", "2024-06-15", "note")).rejects.toThrow(NotFoundError);
        });

        it("creates todo with PENDING when no existing todo", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue(null);
            mockTodoCreateOrUpdate.mockResolvedValue(undefined);
            mockStatsUpdateStats.mockResolvedValue(undefined);

            await service.updateNotes("user-1", "h1", "2024-06-15", "new note");

            expect(mockTodoCreateOrUpdate).toHaveBeenCalled();
        });

        it("updates notes directly when todo exists", async () => {
            mockHabitFindById.mockResolvedValue(baseHabit);
            mockTodoFindByUserDateAndHabit.mockResolvedValue({ status: TODO_STATUS.PENDING });
            mockTodoUpdateNotes.mockResolvedValue(undefined);

            await service.updateNotes("user-1", "h1", "2024-06-15", "updated note");

            expect(mockTodoUpdateNotes).toHaveBeenCalledWith("user-1", "2024-06-15", "h1", "updated note");
        });
    });
});
