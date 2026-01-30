import { describe, it, expect, vi, beforeEach } from "vitest";
import { StatsService } from "../../src/services/StatsService.js";
import { TODO_STATUS } from "../../src/constants/todo.constants.js";

const {
    mockUpdateStreakFields,
    mockGet,
    mockTodayISO,
    mockGetHabitById,
    mockGetScheduledDates,
    mockFindAllByDateRange,
    mockFindByUserDateAndHabit,
} = vi.hoisted(() => ({
    mockUpdateStreakFields: vi.fn(),
    mockGet: vi.fn(),
    mockTodayISO: vi.fn(),
    mockGetHabitById: vi.fn(),
    mockGetScheduledDates: vi.fn(),
    mockFindAllByDateRange: vi.fn(),
    mockFindByUserDateAndHabit: vi.fn(),
}));

vi.mock("../../src/repositories/StatsRepository.js", () => ({
    StatsRepository: vi.fn().mockImplementation(() => ({
        get: mockGet,
        updateStreakFields: mockUpdateStreakFields,
        create: vi.fn(),
    })),
}));

vi.mock("../../src/repositories/TodoRepository.js", () => ({
    TodoRepository: vi.fn().mockImplementation(() => ({
        findByUserDateAndHabit: mockFindByUserDateAndHabit,
        findAllByDateRange: mockFindAllByDateRange,
    })),
}));

vi.mock("../../src/services/HabitService.js", () => ({
    HabitService: vi.fn().mockImplementation(() => ({
        getHabitById: mockGetHabitById,
        getScheduledDates: mockGetScheduledDates,
    })),
}));

vi.mock("../../src/utils/util.js", () => ({
    todayISO: (...args: unknown[]) => mockTodayISO(...args),
    addDays: vi.fn((date: string, delta: number) => {
        const [y, m, d] = date.split("-").map(Number);
        const next = new Date(y, m - 1, d);
        next.setDate(next.getDate() + delta);
        return next.toISOString().slice(0, 10);
    }),
}));

describe("StatsService", () => {
    describe("updateStatsOnTodoStatusChange", () => {
        beforeEach(() => {
            vi.clearAllMocks();
        });

        it("returns early when newStatus equals previousStatus (DONE)", async () => {
            const service = new StatsService();
            mockTodayISO.mockReturnValue("2025-01-15");

            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: "2025-01-15",
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.DONE,
            });

            expect(mockGet).not.toHaveBeenCalled();
            expect(mockUpdateStreakFields).not.toHaveBeenCalled();
        });

        it("returns early when newStatus equals previousStatus (PENDING)", async () => {
            const service = new StatsService();
            mockTodayISO.mockReturnValue("2025-01-15");

            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: "2025-01-15",
                newStatus: TODO_STATUS.PENDING,
                previousStatus: TODO_STATUS.PENDING,
            });

            expect(mockGet).not.toHaveBeenCalled();
            expect(mockUpdateStreakFields).not.toHaveBeenCalled();
        });

        it("calls updateHabitStatsIncremental when date is today and newStatus is DONE (new streak)", async () => {
            const service = new StatsService();
            const today = "2025-01-15";
            mockTodayISO.mockReturnValue(today);
            mockGet.mockResolvedValue({
                currentStreak: 0,
                longestStreak: 0,
                totalCompletions: 0,
            });

            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            expect(mockGet).toHaveBeenCalledWith("USER#user-1", "STATS#HABIT#habit-1");
            expect(mockUpdateStreakFields).toHaveBeenCalled();
            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(1);
            expect(fields.totalCompletions).toBe(1);
            expect(fields.lastCompletedDate).toBe(today);
        });

        it("calls updateHabitStatsIncremental when date is today and newStatus is DONE (extends streak)", async () => {
            const today = "2025-01-15";
            const yesterday = "2025-01-14";
            mockTodayISO.mockReturnValue(today);
            mockGet.mockResolvedValue({
                currentStreak: 1,
                longestStreak: 1,
                lastCompletedDate: yesterday,
                totalCompletions: 1,
            });

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(2);
            expect(fields.totalCompletions).toBe(2);
            expect(fields.lastCompletedDate).toBe(today);
            expect(fields.longestStreak).toBe(2);
        });

        it("calls updateHabitStatsIncremental when date is today and previousStatus is DONE, yesterday DONE (decrements streak)", async () => {
            const today = "2025-01-15";
            const yesterday = "2025-01-14";
            mockTodayISO.mockReturnValue(today);
            mockGet.mockResolvedValue({
                currentStreak: 2,
                longestStreak: 2,
                lastCompletedDate: today,
                totalCompletions: 2,
            });
            mockFindByUserDateAndHabit.mockResolvedValue({
                userId: "user-1",
                habitId: "habit-1",
                date: yesterday,
                status: TODO_STATUS.DONE,
            });

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.PENDING,
                previousStatus: TODO_STATUS.DONE,
            });

            expect(mockFindByUserDateAndHabit).toHaveBeenCalledWith("user-1", yesterday, "habit-1");
            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(1);
            expect(fields.totalCompletions).toBe(1);
            expect(fields.lastCompletedDate).toBe(yesterday);
        });

        it("calls updateHabitStatsIncremental when date is today and previousStatus is DONE, yesterday not DONE (resets streak)", async () => {
            const today = "2025-01-15";
            const yesterday = "2025-01-14";
            mockTodayISO.mockReturnValue(today);
            mockGet.mockResolvedValue({
                currentStreak: 2,
                longestStreak: 2,
                lastCompletedDate: today,
                totalCompletions: 2,
            });
            mockFindByUserDateAndHabit.mockResolvedValue(null);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.PENDING,
                previousStatus: TODO_STATUS.DONE,
            });

            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(0);
            expect(fields.totalCompletions).toBe(1);
            expect(fields.lastCompletedDate).toBeUndefined();
            expect(fields.longestStreak).toBe(2);
        });

        it("calls updateHabitStatsIncremental when date is today and previousStatus is DONE but lastCompletedDate is not today (only totalCompletions decreases)", async () => {
            const today = "2025-01-15";
            mockTodayISO.mockReturnValue(today);
            mockGet.mockResolvedValue({
                currentStreak: 3,
                longestStreak: 5,
                lastCompletedDate: "2025-01-10",
                totalCompletions: 4,
            });

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.PENDING,
                previousStatus: TODO_STATUS.DONE,
            });

            expect(mockFindByUserDateAndHabit).not.toHaveBeenCalled();
            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(3);
            expect(fields.totalCompletions).toBe(3);
            expect(fields.lastCompletedDate).toBe("2025-01-10");
        });

        it("calls updateHabitStatsIncremental when date is today and status changes to SKIPPED from PENDING (no completion change)", async () => {
            const today = "2025-01-15";
            mockTodayISO.mockReturnValue(today);
            mockGet.mockResolvedValue({
                currentStreak: 1,
                longestStreak: 1,
                lastCompletedDate: today,
                totalCompletions: 1,
            });

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.SKIPPED,
                previousStatus: TODO_STATUS.PENDING,
            });

            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(1);
            expect(fields.totalCompletions).toBe(1);
            expect(fields.lastCompletedDate).toBe(today);
        });

        it("calls recalculateHabitStats when date is not today", async () => {
            mockTodayISO.mockReturnValue("2025-01-15");
            mockGetHabitById.mockResolvedValue({
                id: "habit-1",
                userId: "user-1",
                categoryId: "cat-1",
                start_date: "2025-01-01",
                end_date: undefined,
            });
            mockGetScheduledDates.mockResolvedValue(["2025-01-10", "2025-01-11"]);
            mockFindAllByDateRange.mockResolvedValue([
                { habitId: "habit-1", date: "2025-01-10", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-11", status: TODO_STATUS.DONE },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: "2025-01-10",
                newStatus: TODO_STATUS.PENDING,
                previousStatus: TODO_STATUS.DONE,
            });

            expect(mockGetHabitById).toHaveBeenCalledWith("user-1", "habit-1");
            expect(mockUpdateStreakFields).toHaveBeenCalled();
        });

        it("Anki scenario: 22-29 Jan with gaps, change 23 to Done → currentStreak 2, longestStreak 4", async () => {
            // Scenario: 22 Done, 23 Pending→Done, 24 Done, 25 Done, 26 Pending, 27 Done, 28 Done, 29 Pending
            // After changing 23 to Done: completed = 22,23,24,25,27,28. Current streak from 29 backwards = 28,27 = 2. Longest run = 22,23,24,25 = 4.
            mockTodayISO.mockReturnValue("2025-01-29");
            mockGetHabitById.mockResolvedValue({
                id: "habit-1",
                userId: "user-1",
                categoryId: "cat-1",
                start_date: "2025-01-22",
                end_date: "2025-01-29",
            });
            const scheduledDates = [
                "2025-01-22",
                "2025-01-23",
                "2025-01-24",
                "2025-01-25",
                "2025-01-26",
                "2025-01-27",
                "2025-01-28",
                "2025-01-29",
            ];
            mockGetScheduledDates.mockResolvedValue(scheduledDates);
            mockFindAllByDateRange.mockResolvedValue([
                { habitId: "habit-1", date: "2025-01-22", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-23", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-24", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-25", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-26", status: TODO_STATUS.PENDING },
                { habitId: "habit-1", date: "2025-01-27", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-28", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-29", status: TODO_STATUS.PENDING },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: "2025-01-23",
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            expect(mockUpdateStreakFields).toHaveBeenCalled();
            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(2);
            expect(fields.longestStreak).toBe(4);
        });

        it("Anki scenario: 22-29 Jan with gaps, change 26 to Done → currentStreak 5, longestStreak 5", async () => {
            // Scenario: 22 Done, 23 Pending, 24 Done, 25 Done, 26 Pending→Done, 27 Done, 28 Done, 29 Pending
            // After changing 26 to Done: completed = 22,24,25,26,27,28. Current streak from 29 backwards = 28,27,26,25,24 = 5. Longest run = 24,25,26,27,28 = 5.
            mockTodayISO.mockReturnValue("2025-01-29");
            mockGetHabitById.mockResolvedValue({
                id: "habit-1",
                userId: "user-1",
                categoryId: "cat-1",
                start_date: "2025-01-22",
                end_date: "2025-01-29",
            });
            const scheduledDates = [
                "2025-01-22",
                "2025-01-23",
                "2025-01-24",
                "2025-01-25",
                "2025-01-26",
                "2025-01-27",
                "2025-01-28",
                "2025-01-29",
            ];
            mockGetScheduledDates.mockResolvedValue(scheduledDates);
            mockFindAllByDateRange.mockResolvedValue([
                { habitId: "habit-1", date: "2025-01-22", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-23", status: TODO_STATUS.PENDING },
                { habitId: "habit-1", date: "2025-01-24", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-25", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-26", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-27", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-28", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-29", status: TODO_STATUS.PENDING },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: "2025-01-26",
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            expect(mockUpdateStreakFields).toHaveBeenCalled();
            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(5);
            expect(fields.longestStreak).toBe(5);
        });
    });
});
