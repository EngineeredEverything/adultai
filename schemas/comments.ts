import * as z from "zod";

// Schema Definitions
export const getImageCommentsDataSchema = z.object({
    count: z.boolean().optional(),
    limit: z
        .object({
            start: z.number(),
            end: z.number(),
        })
        .optional(),
})

