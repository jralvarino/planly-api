import { z } from "zod";

export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1),
    }),
});

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const updateCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1),
    }),
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});

export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

export const getCategoryByIdSchema = z.object({
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});

export type GetCategoryByIdInput = z.infer<typeof getCategoryByIdSchema>;

export const deleteCategorySchema = z.object({
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});

export type DeleteCategoryInput = z.infer<typeof deleteCategorySchema>;
