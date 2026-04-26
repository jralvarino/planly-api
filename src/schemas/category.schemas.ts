import { z } from "zod";

export const createCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1),
    }),
});


export const updateCategorySchema = z.object({
    body: z.object({
        name: z.string().min(1),
    }),
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});


export const getCategoryByIdSchema = z.object({
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});


export const deleteCategorySchema = z.object({
    pathParameters: z.object({
        id: z.string().min(1),
    }),
});

