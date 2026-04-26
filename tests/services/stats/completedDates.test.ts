import { describe, it, expect } from "vitest";
import { getCompletedDatesFromTodoList } from "../../../src/services/stats/completedDates.js";
import { TODO_STATUS } from "../../../src/constants/todo.constants.js";
import type { Todo } from "../../../src/models/Todo.js";

function makeTodo(overrides: Partial<Todo>): Todo {
    return {
        PK: "USER#user-1",
        SK: `DATE#2024-06-15#HABIT#h1`,
        userId: "user-1",
        habitId: "h1",
        date: "2024-06-15",
        status: TODO_STATUS.PENDING,
        progress: 0,
        target: 1,
        notes: "",
        createdAt: "2024-06-15T00:00:00Z",
        updatedAt: "2024-06-15T00:00:00Z",
        ...overrides,
    } as Todo;
}

describe("getCompletedDatesFromTodoList", () => {
    it("returns dates where habitId is DONE", () => {
        const todos: Todo[] = [
            makeTodo({ habitId: "h1", date: "2024-06-15", status: TODO_STATUS.DONE }),
            makeTodo({ habitId: "h1", date: "2024-06-16", status: TODO_STATUS.PENDING }),
            makeTodo({ habitId: "h1", date: "2024-06-17", status: TODO_STATUS.DONE }),
        ];
        const result = getCompletedDatesFromTodoList(todos, "h1");
        expect(result).toEqual(new Set(["2024-06-15", "2024-06-17"]));
    });

    it("ignores todos for a different habitId", () => {
        const todos: Todo[] = [
            makeTodo({ habitId: "h1", date: "2024-06-15", status: TODO_STATUS.DONE }),
            makeTodo({ habitId: "h2", date: "2024-06-15", status: TODO_STATUS.DONE }),
        ];
        const result = getCompletedDatesFromTodoList(todos, "h1");
        expect(result).toEqual(new Set(["2024-06-15"]));
    });

    it("returns empty set when no todos match", () => {
        const todos: Todo[] = [
            makeTodo({ habitId: "h1", date: "2024-06-15", status: TODO_STATUS.PENDING }),
        ];
        const result = getCompletedDatesFromTodoList(todos, "h1");
        expect(result).toEqual(new Set());
    });

    it("returns empty set for empty input", () => {
        const result = getCompletedDatesFromTodoList([], "h1");
        expect(result).toEqual(new Set());
    });
});

