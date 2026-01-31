import { describe, it, expect, vi, beforeEach } from "vitest";
import { TODO_STATUS } from "../../../src/constants/todo.constants.js";

const {
    mockFindAllUsers,
    mockFindByUserDateAndHabit,
    mockGetTodoListByDate,
    mockRecalculateStreaksAfterMidnight,
    mockTodayISO,
} = vi.hoisted(() => ({
    mockFindAllUsers: vi.fn(),
    mockFindByUserDateAndHabit: vi.fn(),
    mockGetTodoListByDate: vi.fn(),
    mockRecalculateStreaksAfterMidnight: vi.fn(),
    mockTodayISO: vi.fn(),
}));

vi.mock("../../../src/repositories/UserRepository.js", () => ({
    UserRepository: vi.fn().mockImplementation(() => ({
        findAll: mockFindAllUsers,
    })),
}));

vi.mock("../../../src/repositories/TodoRepository.js", () => ({
    TodoRepository: vi.fn().mockImplementation(() => ({
        findByUserDateAndHabit: mockFindByUserDateAndHabit,
    })),
}));

vi.mock("../../../src/services/TodoService.js", () => ({
    TodoService: vi.fn().mockImplementation(() => ({
        getTodoListByDate: mockGetTodoListByDate,
    })),
}));

vi.mock("../../../src/services/StatsService.js", () => ({
    StatsService: vi.fn().mockImplementation(() => ({
        recalculateStreaksAfterMidnight: mockRecalculateStreaksAfterMidnight,
    })),
}));

vi.mock("../../../src/utils/util.js", () => ({
    todayISO: (...args: unknown[]) => mockTodayISO(...args),
    addDays: vi.fn((date: string, delta: number) => {
        const [y, m, d] = date.split("-").map(Number);
        const next = new Date(y, m - 1, d);
        next.setDate(next.getDate() + delta);
        return next.toISOString().slice(0, 10);
    }),
}));

import { handler } from "../../../src/handlers/stats-midnight/index.js";

describe("stats-midnight handler", () => {
    const yesterday = "2025-01-30";
    const today = "2025-01-31";

    beforeEach(() => {
        vi.clearAllMocks();
        mockTodayISO.mockReturnValue(today);
    });

    it("exits early when no users found", async () => {
        mockFindAllUsers.mockResolvedValue([]);

        await handler({} as any, {} as any, () => {});

        expect(mockFindAllUsers).toHaveBeenCalledTimes(1);
        expect(mockGetTodoListByDate).not.toHaveBeenCalled();
        expect(mockRecalculateStreaksAfterMidnight).not.toHaveBeenCalled();
    });

    it("skips user when getTodoListByDate returns empty (no habits for yesterday)", async () => {
        mockFindAllUsers.mockResolvedValue([{ userId: "user-1" }]);
        mockGetTodoListByDate.mockResolvedValue([]);

        await handler({} as any, {} as any, () => {});

        expect(mockGetTodoListByDate).toHaveBeenCalledWith("user-1", yesterday);
        expect(mockFindByUserDateAndHabit).not.toHaveBeenCalled();
        expect(mockRecalculateStreaksAfterMidnight).not.toHaveBeenCalled();
    });

    it("skips user when all habits for yesterday are DONE (no recalc)", async () => {
        mockFindAllUsers.mockResolvedValue([{ userId: "user-1" }]);
        mockGetTodoListByDate.mockResolvedValue([
            { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.DONE },
            { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.DONE },
        ]);

        await handler({} as any, {} as any, () => {});

        expect(mockGetTodoListByDate).toHaveBeenCalledWith("user-1", yesterday);
        expect(mockFindByUserDateAndHabit).not.toHaveBeenCalled();
        expect(mockRecalculateStreaksAfterMidnight).not.toHaveBeenCalled();
    });

    it("recalculates when TODO row does not exist for a habit (no action)", async () => {
        mockFindAllUsers.mockResolvedValue([{ userId: "user-1" }]);
        mockGetTodoListByDate.mockResolvedValue([
            { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.PENDING },
        ]);
        mockFindByUserDateAndHabit.mockResolvedValue(null);

        await handler({} as any, {} as any, () => {});

        expect(mockFindByUserDateAndHabit).toHaveBeenCalledWith("user-1", yesterday, "habit-1");
        expect(mockRecalculateStreaksAfterMidnight).toHaveBeenCalledTimes(1);
        expect(mockRecalculateStreaksAfterMidnight).toHaveBeenCalledWith("user-1", "habit-1", "cat-1");
    });

    it("does not recalculate when TODO row exists (user took action)", async () => {
        mockFindAllUsers.mockResolvedValue([{ userId: "user-1" }]);
        mockGetTodoListByDate.mockResolvedValue([
            { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.PENDING },
        ]);
        mockFindByUserDateAndHabit.mockResolvedValue({
            userId: "user-1",
            habitId: "habit-1",
            date: yesterday,
            status: TODO_STATUS.PENDING,
        });

        await handler({} as any, {} as any, () => {});

        expect(mockFindByUserDateAndHabit).toHaveBeenCalledWith("user-1", yesterday, "habit-1");
        expect(mockRecalculateStreaksAfterMidnight).not.toHaveBeenCalled();
    });

    it("recalculates only for habits with no TODO row (mixed list)", async () => {
        mockFindAllUsers.mockResolvedValue([{ userId: "user-1" }]);
        mockGetTodoListByDate.mockResolvedValue([
            { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.DONE },
            { id: "habit-2", categoryId: "cat-1", status: TODO_STATUS.PENDING },
            { id: "habit-3", categoryId: "cat-2", status: TODO_STATUS.SKIPPED },
        ]);
        mockFindByUserDateAndHabit
            .mockResolvedValueOnce({ userId: "user-1", habitId: "habit-1", date: yesterday, status: TODO_STATUS.DONE })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ userId: "user-1", habitId: "habit-3", date: yesterday, status: TODO_STATUS.SKIPPED });

        await handler({} as any, {} as any, () => {});

        expect(mockFindByUserDateAndHabit).toHaveBeenCalledTimes(3);
        expect(mockRecalculateStreaksAfterMidnight).toHaveBeenCalledTimes(1);
        expect(mockRecalculateStreaksAfterMidnight).toHaveBeenCalledWith("user-1", "habit-2", "cat-1");
    });

    it("processes multiple users and recalculates for each user when no TODO", async () => {
        mockFindAllUsers.mockResolvedValue([{ userId: "user-1" }, { userId: "user-2" }]);
        mockGetTodoListByDate
            .mockResolvedValueOnce([{ id: "habit-a", categoryId: "cat-1", status: TODO_STATUS.PENDING }])
            .mockResolvedValueOnce([{ id: "habit-b", categoryId: "cat-2", status: TODO_STATUS.PENDING }]);
        mockFindByUserDateAndHabit.mockResolvedValue(null);

        await handler({} as any, {} as any, () => {});

        expect(mockGetTodoListByDate).toHaveBeenCalledWith("user-1", yesterday);
        expect(mockGetTodoListByDate).toHaveBeenCalledWith("user-2", yesterday);
        expect(mockRecalculateStreaksAfterMidnight).toHaveBeenCalledWith("user-1", "habit-a", "cat-1");
        expect(mockRecalculateStreaksAfterMidnight).toHaveBeenCalledWith("user-2", "habit-b", "cat-2");
        expect(mockRecalculateStreaksAfterMidnight).toHaveBeenCalledTimes(2);
    });

    it("uses empty string for categoryId when item.categoryId is missing", async () => {
        mockFindAllUsers.mockResolvedValue([{ userId: "user-1" }]);
        mockGetTodoListByDate.mockResolvedValue([
            { id: "habit-1", categoryId: undefined, status: TODO_STATUS.PENDING },
        ]);
        mockFindByUserDateAndHabit.mockResolvedValue(null);

        await handler({} as any, {} as any, () => {});

        expect(mockRecalculateStreaksAfterMidnight).toHaveBeenCalledWith("user-1", "habit-1", "");
    });

    it("throws when recalculateStreaksAfterMidnight throws", async () => {
        mockFindAllUsers.mockResolvedValue([{ userId: "user-1" }]);
        mockGetTodoListByDate.mockResolvedValue([
            { id: "habit-1", categoryId: "cat-1", status: TODO_STATUS.PENDING },
        ]);
        mockFindByUserDateAndHabit.mockResolvedValue(null);
        mockRecalculateStreaksAfterMidnight.mockRejectedValue(new Error("Recalc failed"));

        await expect(handler({} as any, {} as any, () => {})).rejects.toThrow("Recalc failed");
    });
});
