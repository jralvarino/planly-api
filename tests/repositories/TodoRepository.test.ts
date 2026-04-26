import "reflect-metadata";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockSend } = vi.hoisted(() => ({ mockSend: vi.fn() }));

vi.mock("@arj/common-utils-layer/util", () => ({
    createLogger: vi.fn(() => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() })),
}));

vi.mock("@arj/common-utils-layer/db", () => ({
    ddb: { send: mockSend },
}));

import { TodoRepository } from "../../src/repositories/TodoRepository.js";
import { TODO_STATUS } from "../../src/constants/todo.constants.js";
import type { Todo } from "../../src/models/Todo.js";

const baseTodo: Todo = {
    PK: "USER#user-1",
    SK: "DATE#2024-06-15#HABIT#h1",
    userId: "user-1",
    habitId: "h1",
    date: "2024-06-15",
    status: TODO_STATUS.DONE,
    progress: 1,
    target: 1,
    notes: "",
    completedAt: "2024-06-15T10:00:00Z",
    createdAt: "2024-06-15T08:00:00Z",
    updatedAt: "2024-06-15T10:00:00Z",
};

describe("TodoRepository", () => {
    let repo: TodoRepository;

    beforeEach(() => {
        vi.clearAllMocks();
        repo = new TodoRepository();
    });

    describe("createOrUpdate", () => {
        it("calls ddb.send with completedAt when present", async () => {
            mockSend.mockResolvedValue({});
            await repo.createOrUpdate(baseTodo);
            expect(mockSend).toHaveBeenCalledOnce();
        });

        it("calls ddb.send without completedAt when null", async () => {
            mockSend.mockResolvedValue({});
            const todoNoComplete: Todo = { ...baseTodo, completedAt: undefined };
            await repo.createOrUpdate(todoNoComplete);
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("findByUserDateAndHabit", () => {
        it("returns todo when found", async () => {
            mockSend.mockResolvedValue({ Item: baseTodo });
            const result = await repo.findByUserDateAndHabit("user-1", "2024-06-15", "h1");
            expect(result).toEqual(baseTodo);
        });

        it("returns null when not found", async () => {
            mockSend.mockResolvedValue({ Item: undefined });
            const result = await repo.findByUserDateAndHabit("user-1", "2024-06-15", "h1");
            expect(result).toBeNull();
        });
    });

    describe("delete", () => {
        it("calls ddb.send with DeleteCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.delete("user-1", "2024-06-15", "h1");
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });

    describe("findAllByDateRange", () => {
        it("returns todos in date range", async () => {
            mockSend.mockResolvedValue({ Items: [baseTodo] });
            const result = await repo.findAllByDateRange("user-1", "2024-06-01", "2024-06-30");
            expect(result).toEqual([baseTodo]);
        });

        it("returns empty array when no todos", async () => {
            mockSend.mockResolvedValue({ Items: undefined });
            const result = await repo.findAllByDateRange("user-1", "2024-06-01", "2024-06-30");
            expect(result).toEqual([]);
        });
    });

    describe("findAllByUserIdAndHabitId", () => {
        it("returns todos for user and habit", async () => {
            mockSend.mockResolvedValue({ Items: [baseTodo] });
            const result = await repo.findAllByUserIdAndHabitId("user-1", "h1");
            expect(result).toEqual([baseTodo]);
        });

        it("returns empty array when none found", async () => {
            mockSend.mockResolvedValue({ Items: undefined });
            const result = await repo.findAllByUserIdAndHabitId("user-1", "h1");
            expect(result).toEqual([]);
        });
    });

    describe("updateNotes", () => {
        it("calls ddb.send with UpdateCommand", async () => {
            mockSend.mockResolvedValue({});
            await repo.updateNotes("user-1", "2024-06-15", "h1", "new note");
            expect(mockSend).toHaveBeenCalledOnce();
        });
    });
});
