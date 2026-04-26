import { describe, it, expect } from "vitest";
import {
    createCategorySchema,
    updateCategorySchema,
    getCategoryByIdSchema,
    deleteCategorySchema,
} from "../../src/schemas/category.schemas.js";
import {
    createHabitSchema,
    updateHabitSchema,
    getHabitByIdSchema,
    deleteHabitSchema,
} from "../../src/schemas/habit.schemas.js";
import {
    updateTodoStatusSchema,
    updateTodoNotesSchema,
} from "../../src/schemas/todo.schemas.js";

describe("category.schemas", () => {
    describe("createCategorySchema", () => {
        it("accepts valid body", () => {
            const result = createCategorySchema.safeParse({ body: { name: "Health" } });
            expect(result.success).toBe(true);
        });

        it("rejects empty name", () => {
            const result = createCategorySchema.safeParse({ body: { name: "" } });
            expect(result.success).toBe(false);
        });

        it("rejects missing name", () => {
            const result = createCategorySchema.safeParse({ body: {} });
            expect(result.success).toBe(false);
        });
    });

    describe("updateCategorySchema", () => {
        it("accepts valid body and pathParameters", () => {
            const result = updateCategorySchema.safeParse({
                body: { name: "Fitness" },
                pathParameters: { id: "cat-1" },
            });
            expect(result.success).toBe(true);
        });

        it("rejects missing pathParameters.id", () => {
            const result = updateCategorySchema.safeParse({
                body: { name: "Fitness" },
                pathParameters: { id: "" },
            });
            expect(result.success).toBe(false);
        });
    });

    describe("getCategoryByIdSchema", () => {
        it("accepts valid pathParameters", () => {
            const result = getCategoryByIdSchema.safeParse({ pathParameters: { id: "cat-1" } });
            expect(result.success).toBe(true);
        });

        it("rejects empty id", () => {
            const result = getCategoryByIdSchema.safeParse({ pathParameters: { id: "" } });
            expect(result.success).toBe(false);
        });
    });

    describe("deleteCategorySchema", () => {
        it("accepts valid pathParameters", () => {
            const result = deleteCategorySchema.safeParse({ pathParameters: { id: "cat-1" } });
            expect(result.success).toBe(true);
        });

        it("rejects empty id", () => {
            const result = deleteCategorySchema.safeParse({ pathParameters: { id: "" } });
            expect(result.success).toBe(false);
        });
    });
});

describe("habit.schemas", () => {
    describe("createHabitSchema", () => {
        it("accepts valid body", () => {
            const result = createHabitSchema.safeParse({
                body: { title: "Exercise", categoryId: "cat-1" },
            });
            expect(result.success).toBe(true);
        });

        it("accepts all optional fields", () => {
            const result = createHabitSchema.safeParse({
                body: {
                    title: "Exercise",
                    categoryId: "cat-1",
                    description: "Daily exercise",
                    color: "#FF0000",
                    emoji: "💪",
                    unit: "count",
                    value: "1",
                    period_type: "every_day",
                    period_value: "",
                    period: "Morning",
                    reminder_time: "08:00",
                    start_date: "2024-01-01",
                    end_date: "2024-12-31",
                    active: true,
                },
            });
            expect(result.success).toBe(true);
        });

        it("rejects empty title", () => {
            const result = createHabitSchema.safeParse({
                body: { title: "", categoryId: "cat-1" },
            });
            expect(result.success).toBe(false);
        });

        it("rejects invalid unit", () => {
            const result = createHabitSchema.safeParse({
                body: { title: "Ex", categoryId: "cat-1", unit: "invalid" },
            });
            expect(result.success).toBe(false);
        });
    });

    describe("updateHabitSchema", () => {
        it("accepts valid partial body with pathParameters", () => {
            const result = updateHabitSchema.safeParse({
                body: { title: "Updated Exercise" },
                pathParameters: { id: "habit-1" },
            });
            expect(result.success).toBe(true);
        });

        it("accepts empty body with valid pathParameters", () => {
            const result = updateHabitSchema.safeParse({
                body: {},
                pathParameters: { id: "habit-1" },
            });
            expect(result.success).toBe(true);
        });

        it("rejects empty pathParameters.id", () => {
            const result = updateHabitSchema.safeParse({
                body: { title: "Ex" },
                pathParameters: { id: "" },
            });
            expect(result.success).toBe(false);
        });
    });

    describe("getHabitByIdSchema", () => {
        it("accepts valid pathParameters", () => {
            const result = getHabitByIdSchema.safeParse({ pathParameters: { id: "habit-1" } });
            expect(result.success).toBe(true);
        });

        it("rejects empty id", () => {
            const result = getHabitByIdSchema.safeParse({ pathParameters: { id: "" } });
            expect(result.success).toBe(false);
        });
    });

    describe("deleteHabitSchema", () => {
        it("accepts valid pathParameters", () => {
            const result = deleteHabitSchema.safeParse({ pathParameters: { id: "habit-1" } });
            expect(result.success).toBe(true);
        });
    });
});

describe("todo.schemas", () => {
    describe("updateTodoStatusSchema", () => {
        it("accepts valid DONE status", () => {
            const result = updateTodoStatusSchema.safeParse({
                body: { date: "2024-06-15", status: "done" },
                pathParameters: { habitId: "h1" },
            });
            expect(result.success).toBe(true);
        });

        it("accepts all statuses", () => {
            for (const status of ["done", "pending", "skipped"]) {
                const result = updateTodoStatusSchema.safeParse({
                    body: { date: "2024-06-15", status },
                    pathParameters: { habitId: "h1" },
                });
                expect(result.success).toBe(true);
            }
        });

        it("accepts optional progressValue", () => {
            const result = updateTodoStatusSchema.safeParse({
                body: { date: "2024-06-15", status: "pending", progressValue: 3 },
                pathParameters: { habitId: "h1" },
            });
            expect(result.success).toBe(true);
        });

        it("rejects invalid date format", () => {
            const result = updateTodoStatusSchema.safeParse({
                body: { date: "invalid-date", status: "done" },
                pathParameters: { habitId: "h1" },
            });
            expect(result.success).toBe(false);
        });

        it("rejects invalid status", () => {
            const result = updateTodoStatusSchema.safeParse({
                body: { date: "2024-06-15", status: "invalid" },
                pathParameters: { habitId: "h1" },
            });
            expect(result.success).toBe(false);
        });

        it("rejects empty habitId", () => {
            const result = updateTodoStatusSchema.safeParse({
                body: { date: "2024-06-15", status: "done" },
                pathParameters: { habitId: "" },
            });
            expect(result.success).toBe(false);
        });
    });

    describe("updateTodoNotesSchema", () => {
        it("accepts valid body and pathParameters", () => {
            const result = updateTodoNotesSchema.safeParse({
                body: { date: "2024-06-15", notes: "Great job!" },
                pathParameters: { habitId: "h1" },
            });
            expect(result.success).toBe(true);
        });

        it("accepts empty notes string", () => {
            const result = updateTodoNotesSchema.safeParse({
                body: { date: "2024-06-15", notes: "" },
                pathParameters: { habitId: "h1" },
            });
            expect(result.success).toBe(true);
        });

        it("rejects invalid date format", () => {
            const result = updateTodoNotesSchema.safeParse({
                body: { date: "15/06/2024", notes: "note" },
                pathParameters: { habitId: "h1" },
            });
            expect(result.success).toBe(false);
        });
    });
});
