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
    mockGetTodoListByDate,
} = vi.hoisted(() => ({
    mockUpdateStreakFields: vi.fn(),
    mockGet: vi.fn(),
    mockTodayISO: vi.fn(),
    mockGetHabitById: vi.fn(),
    mockGetScheduledDates: vi.fn(),
    mockFindAllByDateRange: vi.fn(),
    mockFindByUserDateAndHabit: vi.fn(),
    mockGetTodoListByDate: vi.fn(),
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

vi.mock("../../src/services/TodoService.js", () => ({
    TodoService: vi.fn().mockImplementation(() => ({
        getTodoListByDate: mockGetTodoListByDate,
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
            mockGetTodoListByDate.mockResolvedValue([]);
            mockGetHabitById.mockResolvedValue({
                id: "habit-1",
                userId: "user-1",
                categoryId: "cat-1",
                start_date: "2025-01-01",
                end_date: undefined,
            });
            mockGetScheduledDates.mockResolvedValue(["2025-01-14", "2025-01-15"]);
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
            mockFindAllByDateRange.mockResolvedValue([
                { userId: "user-1", habitId: "habit-1", date: yesterday, status: TODO_STATUS.DONE },
            ] as any);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.PENDING,
                previousStatus: TODO_STATUS.DONE,
            });

            const habitCall = mockUpdateStreakFields.mock.calls.find(([_pk, sk]) => sk === "STATS#HABIT#habit-1");
            expect(habitCall).toBeDefined();
            const [, , fields] = habitCall!;
            expect(fields.currentStreak).toBe(1);
            expect(fields.totalCompletions).toBe(1);
            expect(fields.lastCompletedDate).toBe(yesterday);
        });

        it("calls updateHabitStatsIncremental when date is today and previousStatus is DONE, yesterday not DONE (resets streak)", async () => {
            const today = "2025-01-15";
            mockTodayISO.mockReturnValue(today);
            mockGet.mockResolvedValue({
                currentStreak: 2,
                longestStreak: 2,
                lastCompletedDate: today,
                totalCompletions: 2,
            });
            mockFindAllByDateRange.mockResolvedValue([]);

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

        it("Anki scenario: 22-29 Jan with gaps, change 23 to Done → currentStreak 2 (29=today pending), longestStreak 4", async () => {
            // Scenario: 22 Done, 23 Pending→Done, 24 Done, 25 Done, 26 Pending, 27 Done, 28 Done, 29 Pending. Today = 29.
            // Last scheduled 29 = today and pending → show run before = 28,27 = 2. Longest run = 22,23,24,25 = 4.
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

        it("Anki scenario: 22-29 Jan with gaps, change 26 to Done → currentStreak 5 (29=today pending), longestStreak 5", async () => {
            // Scenario: 22 Done, 23 Pending, 24 Done, 25 Done, 26 Pending→Done, 27 Done, 28 Done, 29 Pending. Today = 29.
            // Last scheduled 29 = today and pending → show run before = 28,27,26,25,24 = 5. Longest run = 5.
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

        it("Academia scenario: habit Mon/Wed/Fri, 25-30 Jan, 27 Pending 29 Done → change 27 to Done → currentStreak 2, longestStreak 2", async () => {
            // Habit: Academia, Segunda/Quarta/Sexta. Jan 2025: 27=Mon, 29=Wed (scheduled in 25-30). 26 Pending, 28 Done, 30 Done (user labels); for habit only 27,29 matter. 27 Pending, 29 Done → change 27 to Done → 27+29 both done.
            mockTodayISO.mockReturnValue("2025-01-30");
            mockGetHabitById.mockResolvedValue({
                id: "habit-academia",
                userId: "user-1",
                categoryId: "cat-1",
                start_date: "2025-01-25",
                end_date: "2025-01-30",
                period_type: "specific_days_week",
                period_value: "MON,WED,FRI",
            });
            mockGetScheduledDates.mockResolvedValue(["2025-01-27", "2025-01-29"]);
            mockFindAllByDateRange.mockResolvedValue([
                { habitId: "habit-academia", date: "2025-01-27", status: TODO_STATUS.DONE },
                { habitId: "habit-academia", date: "2025-01-29", status: TODO_STATUS.DONE },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-academia",
                categoryId: "cat-1",
                date: "2025-01-27",
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            expect(mockUpdateStreakFields).toHaveBeenCalled();
            const [, , fields] = mockUpdateStreakFields.mock.calls[0];
            expect(fields.currentStreak).toBe(2);
            expect(fields.longestStreak).toBe(2);
            expect(fields.totalCompletions).toBe(2);
        });

        it("Academia: Seg v, Qua v, Sexta (today) pending → currentStreak 2 (user has until 00:00)", async () => {
            // Habit Mon, Wed, Fri. Seg and Qua done; today = Fri, still pending. Streak shown = 2 (don't count today as failed yet).
            const friday = "2025-01-31";
            mockTodayISO.mockReturnValue(friday);
            mockGetHabitById.mockResolvedValue({
                id: "habit-1",
                userId: "user-1",
                categoryId: "cat-1",
                start_date: "2025-01-27",
                end_date: friday,
                period_type: "specific_days_week",
                period_value: "MON,WED,FRI",
            });
            mockGetScheduledDates.mockResolvedValue(["2025-01-27", "2025-01-29", friday]);
            mockFindAllByDateRange.mockResolvedValue([
                { habitId: "habit-1", date: "2025-01-27", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: "2025-01-29", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: friday, status: TODO_STATUS.PENDING },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: "2025-01-27",
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            const habitCall = mockUpdateStreakFields.mock.calls.find(([_pk, sk]) => sk === "STATS#HABIT#habit-1");
            expect(habitCall).toBeDefined();
            const [, , fields] = habitCall!;
            expect(fields.currentStreak).toBe(2);
            expect(fields.longestStreak).toBe(2);
            expect(fields.totalCompletions).toBe(2);
            expect(fields.lastCompletedDate).toBe("2025-01-29");
        });

        it("Habit Segunda/Quarta/Sexta: Segunda x, Quarta v, Sexta x → user marks Sexta done → habit streak 2", async () => {
            // Habit scheduled Mon, Wed, Fri. State: Mon not done, Wed done, Fri not done. User marks Fri as done.
            // Recalculate uses only scheduled dates (Mon, Wed, Fri); completed = Wed, Fri → consecutive at end = 2.
            const friday = "2025-01-31";
            const saturday = "2025-02-01";
            mockTodayISO.mockReturnValue(saturday);
            mockGetHabitById.mockResolvedValue({
                id: "habit-1",
                userId: "user-1",
                categoryId: "cat-1",
                start_date: "2025-01-27",
                end_date: friday,
                period_type: "specific_days_week",
                period_value: "MON,WED,FRI",
            });
            mockGetScheduledDates.mockResolvedValue(["2025-01-27", "2025-01-29", friday]); // Mon, Wed, Fri
            mockFindAllByDateRange.mockResolvedValue([
                { habitId: "habit-1", date: "2025-01-27", status: TODO_STATUS.PENDING },
                { habitId: "habit-1", date: "2025-01-29", status: TODO_STATUS.DONE },
                { habitId: "habit-1", date: friday, status: TODO_STATUS.DONE },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: friday,
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            const habitCall = mockUpdateStreakFields.mock.calls.find(([_pk, sk]) => sk === "STATS#HABIT#habit-1");
            expect(habitCall).toBeDefined();
            const [, , fields] = habitCall!;
            expect(fields.currentStreak).toBe(2);
            expect(fields.longestStreak).toBe(2);
            expect(fields.totalCompletions).toBe(2);
            expect(fields.lastCompletedDate).toBe(friday);
        });

        describe("specific_days_month", () => {
            const habitId = "habit-month-1";

            function getHabitUpdateCall() {
                return mockUpdateStreakFields.mock.calls.find(([_pk, sk]) => sk === `STATS#HABIT#${habitId}`);
            }

            it("1,15,30 all done → currentStreak 3, longestStreak 3", async () => {
                mockTodayISO.mockReturnValue("2025-02-01");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-01",
                    end_date: "2025-01-31",
                    period_type: "specific_days_month",
                    period_value: "1,15,30",
                });
                mockGetScheduledDates.mockResolvedValue(["2025-01-01", "2025-01-15", "2025-01-30"]);
                mockFindAllByDateRange.mockResolvedValue([
                    { habitId, date: "2025-01-01", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-01-15", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-01-30", status: TODO_STATUS.DONE },
                ]);

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-01-30",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(3);
                expect(fields.longestStreak).toBe(3);
                expect(fields.totalCompletions).toBe(3);
                expect(fields.lastCompletedDate).toBe("2025-01-30");
            });

            it("1 done, 15 not, 30 done → currentStreak 1, longestStreak 1", async () => {
                mockTodayISO.mockReturnValue("2025-02-01");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-01",
                    end_date: "2025-01-31",
                    period_type: "specific_days_month",
                    period_value: "1,15,30",
                });
                mockGetScheduledDates.mockResolvedValue(["2025-01-01", "2025-01-15", "2025-01-30"]);
                mockFindAllByDateRange.mockResolvedValue([
                    { habitId, date: "2025-01-01", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-01-15", status: TODO_STATUS.PENDING },
                    { habitId, date: "2025-01-30", status: TODO_STATUS.DONE },
                ]);

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-01-30",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(1);
                expect(fields.longestStreak).toBe(1);
                expect(fields.totalCompletions).toBe(2);
                expect(fields.lastCompletedDate).toBe("2025-01-30");
            });

            it("5,20 in 3 months, last 20 pending → currentStreak 0 (trailing run), longestStreak 5", async () => {
                mockTodayISO.mockReturnValue("2025-03-21");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-01",
                    end_date: "2025-03-31",
                    period_type: "specific_days_month",
                    period_value: "5,20",
                });
                const scheduled = ["2025-01-05", "2025-01-20", "2025-02-05", "2025-02-20", "2025-03-05", "2025-03-20"];
                mockGetScheduledDates.mockResolvedValue(scheduled);
                mockFindAllByDateRange.mockResolvedValue([
                    { habitId, date: "2025-01-05", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-01-20", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-02-05", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-02-20", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-03-05", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-03-20", status: TODO_STATUS.PENDING },
                ]);

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-03-05",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(0);
                expect(fields.longestStreak).toBe(5);
                expect(fields.totalCompletions).toBe(5);
                expect(fields.lastCompletedDate).toBe("2025-03-05");
            });

            it("5,20 all done in 3 months → currentStreak 6, longestStreak 6", async () => {
                mockTodayISO.mockReturnValue("2025-03-21");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-01",
                    end_date: "2025-03-31",
                    period_type: "specific_days_month",
                    period_value: "5,20",
                });
                const scheduled = ["2025-01-05", "2025-01-20", "2025-02-05", "2025-02-20", "2025-03-05", "2025-03-20"];
                mockGetScheduledDates.mockResolvedValue(scheduled);
                mockFindAllByDateRange.mockResolvedValue(
                    scheduled.map((date) => ({ habitId, date, status: TODO_STATUS.DONE }))
                );

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-03-20",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(6);
                expect(fields.longestStreak).toBe(6);
                expect(fields.totalCompletions).toBe(6);
                expect(fields.lastCompletedDate).toBe("2025-03-20");
            });

            it("only day 1, 2 months done → currentStreak 0 (trailing run), longestStreak 2", async () => {
                mockTodayISO.mockReturnValue("2025-04-02");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-01",
                    end_date: "2025-04-30",
                    period_type: "specific_days_month",
                    period_value: "1",
                });
                mockGetScheduledDates.mockResolvedValue(["2025-01-01", "2025-02-01", "2025-03-01", "2025-04-01"]);
                mockFindAllByDateRange.mockResolvedValue([
                    { habitId, date: "2025-01-01", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-02-01", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-03-01", status: TODO_STATUS.PENDING },
                    { habitId, date: "2025-04-01", status: TODO_STATUS.PENDING },
                ]);

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-02-01",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(0);
                expect(fields.longestStreak).toBe(2);
                expect(fields.totalCompletions).toBe(2);
                expect(fields.lastCompletedDate).toBe("2025-02-01");
            });

            it("only day 30, Jan and Mar done (Feb has no 30) → currentStreak 2", async () => {
                mockTodayISO.mockReturnValue("2025-04-01");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-01",
                    end_date: "2025-03-31",
                    period_type: "specific_days_month",
                    period_value: "30",
                });
                mockGetScheduledDates.mockResolvedValue(["2025-01-30", "2025-03-30"]);
                mockFindAllByDateRange.mockResolvedValue([
                    { habitId, date: "2025-01-30", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-03-30", status: TODO_STATUS.DONE },
                ]);

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-03-30",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(2);
                expect(fields.longestStreak).toBe(2);
                expect(fields.totalCompletions).toBe(2);
                expect(fields.lastCompletedDate).toBe("2025-03-30");
            });

            it("only day 31, Jan and Mar done (Feb/Apr have no 31) → currentStreak 0 (trailing run)", async () => {
                mockTodayISO.mockReturnValue("2025-06-01");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-01",
                    end_date: "2025-05-31",
                    period_type: "specific_days_month",
                    period_value: "31",
                });
                mockGetScheduledDates.mockResolvedValue(["2025-01-31", "2025-03-31", "2025-05-31"]);
                mockFindAllByDateRange.mockResolvedValue([
                    { habitId, date: "2025-01-31", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-03-31", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-05-31", status: TODO_STATUS.PENDING },
                ]);

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-03-31",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(0);
                expect(fields.longestStreak).toBe(2);
                expect(fields.totalCompletions).toBe(2);
                expect(fields.lastCompletedDate).toBe("2025-03-31");
            });

            it("start_date 10/01, 15 and 30 done (1st before start) → currentStreak 2", async () => {
                mockTodayISO.mockReturnValue("2025-02-01");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-10",
                    end_date: "2025-01-31",
                    period_type: "specific_days_month",
                    period_value: "1,15,30",
                });
                mockGetScheduledDates.mockResolvedValue(["2025-01-15", "2025-01-30"]);
                mockFindAllByDateRange.mockResolvedValue([
                    { habitId, date: "2025-01-15", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-01-30", status: TODO_STATUS.DONE },
                ]);

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-01-30",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(2);
                expect(fields.longestStreak).toBe(2);
                expect(fields.totalCompletions).toBe(2);
                expect(fields.lastCompletedDate).toBe("2025-01-30");
            });

            it("mark 30/01 done with today 01/02 (date !== today) → currentStreak 2", async () => {
                mockTodayISO.mockReturnValue("2025-02-01");
                mockGetHabitById.mockResolvedValue({
                    id: habitId,
                    userId: "user-1",
                    categoryId: "cat-1",
                    start_date: "2025-01-01",
                    end_date: "2025-01-31",
                    period_type: "specific_days_month",
                    period_value: "1,15,30",
                });
                mockGetScheduledDates.mockResolvedValue(["2025-01-01", "2025-01-15", "2025-01-30"]);
                mockFindAllByDateRange.mockResolvedValue([
                    { habitId, date: "2025-01-01", status: TODO_STATUS.PENDING },
                    { habitId, date: "2025-01-15", status: TODO_STATUS.DONE },
                    { habitId, date: "2025-01-30", status: TODO_STATUS.DONE },
                ]);

                const service = new StatsService();
                await service.updateStatsOnTodoStatusChange({
                    userId: "user-1",
                    habitId,
                    categoryId: "cat-1",
                    date: "2025-01-30",
                    newStatus: TODO_STATUS.DONE,
                    previousStatus: TODO_STATUS.PENDING,
                });

                const habitCall = getHabitUpdateCall();
                expect(habitCall).toBeDefined();
                const [, , fields] = habitCall!;
                expect(fields.currentStreak).toBe(2);
                expect(fields.longestStreak).toBe(2);
                expect(fields.totalCompletions).toBe(2);
                expect(fields.lastCompletedDate).toBe("2025-01-30");
            });
        });
    });

    describe("updateCategoryStatsIncremental (via updateStatsOnTodoStatusChange)", () => {
        const today = "2025-01-15";
        const yesterday = "2025-01-14";

        beforeEach(() => {
            vi.clearAllMocks();
            mockTodayISO.mockReturnValue(today);
            mockGetTodoListByDate.mockResolvedValue([]);
        });

        function getCategoryUpdateCall() {
            const calls = mockUpdateStreakFields.mock.calls;
            const idx = calls.findIndex(([pk, sk]) => sk === "STATS#CATEGORY#cat-1");
            return idx >= 0 ? calls[idx] : null;
        }

        it("updates category stats when all todos of category today are DONE (new streak)", async () => {
            mockGet.mockImplementation((_pk: string, sk: string) => {
                if (sk.includes("CATEGORY")) {
                    return Promise.resolve({
                        currentStreak: 0,
                        longestStreak: 0,
                        totalCompletions: 0,
                    });
                }
                return Promise.resolve({
                    currentStreak: 0,
                    longestStreak: 0,
                    totalCompletions: 0,
                });
            });
            mockGetTodoListByDate.mockResolvedValue([
                { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.DONE },
                { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.DONE },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            const categoryCall = getCategoryUpdateCall();
            expect(categoryCall).not.toBeNull();
            const [, , fields] = categoryCall!;
            expect(fields.currentStreak).toBe(1);
            expect(fields.totalCompletions).toBe(1);
            expect(fields.lastCompletedDate).toBe(today);
        });

        it("updates category stats when all todos of category today are DONE (extends streak)", async () => {
            mockGet.mockImplementation((_pk: string, sk: string) => {
                if (sk.includes("CATEGORY")) {
                    return Promise.resolve({
                        currentStreak: 1,
                        longestStreak: 1,
                        lastCompletedDate: yesterday,
                        totalCompletions: 1,
                    });
                }
                return Promise.resolve({
                    currentStreak: 0,
                    longestStreak: 0,
                    totalCompletions: 0,
                });
            });
            mockGetTodoListByDate.mockResolvedValue([
                { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.DONE },
                { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.DONE },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            const categoryCall = getCategoryUpdateCall();
            expect(categoryCall).not.toBeNull();
            const [, , fields] = categoryCall!;
            expect(fields.currentStreak).toBe(2);
            expect(fields.totalCompletions).toBe(2);
            expect(fields.lastCompletedDate).toBe(today);
        });

        it("updates category stats when user unmarked one todo and yesterday was all complete (decrements streak)", async () => {
            mockGet.mockImplementation((_pk: string, sk: string) => {
                if (sk.includes("CATEGORY")) {
                    return Promise.resolve({
                        currentStreak: 2,
                        longestStreak: 2,
                        lastCompletedDate: today,
                        totalCompletions: 2,
                    });
                }
                return Promise.resolve({
                    currentStreak: 0,
                    longestStreak: 0,
                    totalCompletions: 0,
                });
            });
            mockGetTodoListByDate.mockImplementation((_userId: string, date: string) => {
                if (date === today) {
                    return Promise.resolve([
                        { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.DONE },
                        { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.PENDING },
                    ]);
                }
                if (date === yesterday) {
                    return Promise.resolve([
                        { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.DONE },
                        { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.DONE },
                    ]);
                }
                return Promise.resolve([]);
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

            const categoryCall = getCategoryUpdateCall();
            expect(categoryCall).not.toBeNull();
            const [, , fields] = categoryCall!;
            expect(fields.currentStreak).toBe(1);
            expect(fields.totalCompletions).toBe(1);
            expect(fields.lastCompletedDate).toBe(yesterday);
        });

        it("updates category stats when user unmarked one todo and yesterday was not all complete (resets streak)", async () => {
            mockGet.mockImplementation((_pk: string, sk: string) => {
                if (sk.includes("CATEGORY")) {
                    return Promise.resolve({
                        currentStreak: 2,
                        longestStreak: 2,
                        lastCompletedDate: today,
                        totalCompletions: 2,
                    });
                }
                return Promise.resolve({
                    currentStreak: 0,
                    longestStreak: 0,
                    totalCompletions: 0,
                });
            });
            mockGetTodoListByDate.mockImplementation((_userId: string, date: string) => {
                if (date === today) {
                    return Promise.resolve([
                        { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.PENDING },
                        { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.DONE },
                    ]);
                }
                if (date === yesterday) {
                    return Promise.resolve([
                        { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.PENDING },
                        { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.DONE },
                    ]);
                }
                return Promise.resolve([]);
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

            const categoryCall = getCategoryUpdateCall();
            expect(categoryCall).not.toBeNull();
            const [, , fields] = categoryCall!;
            expect(fields.currentStreak).toBe(0);
            expect(fields.totalCompletions).toBe(1);
            expect(fields.lastCompletedDate).toBeUndefined();
        });

        it("does not update category stats when not all complete and lastCompletedDate is not today", async () => {
            mockGet.mockImplementation((_pk: string, sk: string) => {
                if (sk.includes("CATEGORY")) {
                    return Promise.resolve({
                        currentStreak: 1,
                        longestStreak: 1,
                        lastCompletedDate: "2025-01-10",
                        totalCompletions: 1,
                    });
                }
                return Promise.resolve({
                    currentStreak: 0,
                    longestStreak: 0,
                    totalCompletions: 0,
                });
            });
            mockGetTodoListByDate.mockResolvedValue([
                { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.DONE },
                { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.PENDING },
            ]);

            const service = new StatsService();
            await service.updateStatsOnTodoStatusChange({
                userId: "user-1",
                habitId: "habit-1",
                categoryId: "cat-1",
                date: today,
                newStatus: TODO_STATUS.DONE,
                previousStatus: TODO_STATUS.PENDING,
            });

            const categoryCall = getCategoryUpdateCall();
            expect(categoryCall).toBeNull();
        });
    });
});
