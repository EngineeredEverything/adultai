import { z } from "zod"

export const createGeneratedVideoSchema = z.object({
  prompt: z.string().min(1, "Prompt is required"),
  count: z.number().min(1).max(10).default(1),
  width: z.number().min(256).max(1920).default(848),
  height: z.number().min(256).max(1080).default(480),
  fps: z.number().min(12).max(60).default(24),
  numFrames: z.number().min(24).max(240).default(81),
  negativePrompt: z.string().optional(),
  isPublic: z.boolean().default(true),
})

export const createGeneratedVideosBatchSchema = z.object({
  videos: z.array(createGeneratedVideoSchema),
})

export const updateVideoSchema = z.object({
  prompt: z.string().optional(),
  isPublic: z.boolean().optional(),
  categoryIds: z.array(z.string()).optional(),
})

export const getVideoInfoSchema = z.object({
  data: z.object({
    comments: z
      .object({
        count: z.boolean().optional(),
        limit: z
          .object({
            start: z.number(),
            end: z.number(),
          })
          .optional(),
      })
      .optional(),
    votes: z
      .object({
        count: z.boolean().optional(),
      })
      .optional(),
    categories: z.boolean().optional(),
  }),
})

export const searchVideosSchema = z.object({
  query: z.string().optional(),
  filters: z
    .object({
      userId: z.string().optional(),
      private: z.boolean().optional(),
      isPublic: z.boolean().optional(),
      category_id: z.string().optional(),
      status: z.enum(["completed", "processing", "failed"]).optional(),
    })
    .optional(),
  data: z.object({
    ids: z.array(z.string()).optional(),
    limit: z
      .object({
        start: z.number(),
        end: z.number(),
      })
      .optional(),
    count: z.boolean().optional(),
    videos: z.object({
      comments: z
        .object({
          count: z.boolean().optional(),
          limit: z
            .object({
              start: z.number(),
              end: z.number(),
            })
            .optional(),
        })
        .optional(),
      votes: z
        .object({
          count: z.boolean().optional(),
        })
        .optional(),
      categories: z.boolean().optional(),
    }),
  }),
})

export const checkVideoStatusSchema = z.object({
  taskId: z.string(),
})

export const getRelatedVideosSchema = z.object({
  videoId: z.string(),
  limit: z.number().optional().default(10),
  data: z
    .object({
      comments: z
        .object({
          count: z.boolean().optional(),
        })
        .optional(),
      votes: z
        .object({
          count: z.boolean().optional(),
        })
        .optional(),
      categories: z.boolean().optional(),
    })
    .optional(),
})
