import { z } from "zod";

const unitEnum = z.enum(["count", "pg", "km", "ml"]);
const periodTypeEnum = z.enum(["every_day", "specific_days_week", "specific_days_month"]);
const periodEnum = z.enum(["Anytime", "Morning", "Afternoon", "Evening"]);

export const createHabitSchema = z.object({
    body: z.object({
        title: z.string().min(1),
        categoryId: z.string().min(1),
        description: z.string().optional(),
        color: z.string().optional(),
        emoji: z.string().optional(),
        unit: unitEnum.optional(),
        value: z.string().optional(),
        period_type: periodTypeEnum.optional(),
        period_value: z.string().optional(),
        period: periodEnum.optional(),
        reminder_time: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        active: z.boolean().optional(),
    }),
});

export type CreateHabitInput = z.infer<typeof createHabitSchema>;

export const updateHabitSchema = z.object({
    body: z.object({
        title: z.string().min(1).optional(),
        description: z.string().optional(),
        color: z.string().optional(),
        emoji: z.string().optional(),
        unit: unitEnum.optional(),
        value: z.string().optional(),
        period_type: periodTypeEnum.optional(),
        period_value: z.string().optional(),
        categoryId: z.string().min(1).optional(),
        period: periodEnum.optional(),
        reminder_time: z.string().optional(),
        start_date: z.string().optional(),
        end_date: z.string().optional(),
        active: z.boolean().optional(),
    }),
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});

export type UpdateHabitInput = z.infer<typeof updateHabitSchema>;

export const getHabitByIdSchema = z.object({
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});

export type GetHabitByIdInput = z.infer<typeof getHabitByIdSchema>;

export const deleteHabitSchema = z.object({
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});

export type DeleteHabitInput = z.infer<typeof deleteHabitSchema>;
