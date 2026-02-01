import { z } from "zod";

const monthRegex = /^\d{4}-\d{2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const getDashboardSchema = z.object({
    queryStringParameters: z.object({
        month: z.string().regex(monthRegex),
        categoryId: z.preprocess((v) => (v === "" ? undefined : v), z.string().optional()),
        selectedDate: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(dateRegex).optional()),
    }),
});

export type GetDashboardInput = z.infer<typeof getDashboardSchema>;
