import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const todoStatusEnum = z.enum(["done", "pending", "skipped"]);

export const updateTodoStatusSchema = z.object({
    body: z.object({
        date: z.string().regex(dateRegex),
        status: todoStatusEnum,
        progressValue: z.coerce.number().min(0).optional(),
        notes: z.string().optional(),
    }),
    pathParameters: z.object({
        habitId: z.string().min(1),
    }),
});

export type UpdateTodoStatusInput = z.infer<typeof updateTodoStatusSchema>;

export const updateTodoNotesSchema = z.object({
    body: z.object({
        date: z.string().regex(dateRegex),
        notes: z.string(),
    }),
    pathParameters: z.object({
        habitId: z.string().min(1),
    }),
});

export type UpdateTodoNotesInput = z.infer<typeof updateTodoNotesSchema>;
