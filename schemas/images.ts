// schemas/images.ts

import * as z from "zod";
import { getImageVotesDataSchema } from "./votes";

export const updateImageSchema = z.object({
  prompt: z.optional(z.string()),
  isPublic: z.optional(z.boolean()),
  status: z.optional(z.enum(["completed", "flagged", "rejected"])),
  categoryIds: z.array(z.string()).optional(),
});

// Updated image info schema to include votes
export const getImageInfoDataSchema = z.object({
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
  votes: getImageVotesDataSchema.optional(),
  categories: z.optional(z.boolean()),
})


// Schema Definitions
export const createGeneratedImageSchema = z.object({
  prompt: z.string(),
  count: z.number().min(1).max(10),
  width: z.optional(z.number().int().default(1024)),
  height: z.optional(z.number().int().default(1024)),
  isPublic: z.boolean().default(false),
})

export const createGeneratedImagesBatchSchema = z.object({
  images: z.array(createGeneratedImageSchema),
})

// Schema for advanced generation options
export const advancedGenerationSchema = z.object({
  options: z.object({
    prompt: z.string(),
    negativePrompt: z.string().optional(),
    seed: z.string().optional(),
    modelId: z.string(),
    steps: z.number().min(10).max(100),
    cfg: z.number().min(1).max(20),
    sampler: z.string(),
    width: z.number().min(256).max(1024),
    height: z.number().min(256).max(1024),
    count: z.number().min(1).max(4),
    hiresFix: z.boolean().optional(),
    hiresScale: z.number().min(1).max(4).optional(),
    hiresDenoise: z.number().min(0.1).max(0.99).optional(),
    hiresSteps: z.number().min(10).max(50).optional(),
    faceRestore: z.boolean().optional(),
    faceRestoreStrength: z.number().min(0).max(1).optional(),
    loras: z.array(z.object({
      id: z.string(),
      strength: z.number().min(-1).max(2),
    })).optional(),
  }),
})


export const checkImageStatusSchema = z.object({
  taskId: z.string(),
})



export const getImageInfoSchema = z.object({
  imageId: z.string(),
  data: getImageInfoDataSchema,
})

export const searchImagesSchema = z.object({
  query: z.string().optional(),
  filters: z
    .object({
      isPublic: z.boolean().optional(),
      userId: z.string().optional(),
      private: z.boolean().optional(),
      category_id: z.string().optional(),
      status: z.string().optional(),
      sort: z.enum(["newest", "votes_desc", "votes_asc"]).optional(),
      // Vote filters
      minUpvotes: z.number().min(0).optional(),
      maxUpvotes: z.number().min(0).optional(),
      minDownvotes: z.number().min(0).optional(),
      maxDownvotes: z.number().min(0).optional(),
      minVoteScore: z.number().optional(),
      maxVoteScore: z.number().optional(),
      hasVotes: z.boolean().optional(), // Filter for images that have any votes
      voteRatio: z.enum(["positive", "negative", "neutral"]).optional(), // Filter by vote ratio
    })
    .optional(),
  data: z.object({
    count: z.boolean().optional(),
    limit: z
      .object({
        start: z.number(),
        end: z.number(),
      })
      .optional(),
    images: getImageInfoDataSchema,
    ids: z.optional(z.array(z.string())),
  }),
})


export const getRelatedImagesSchema = z.object({
  imageId: z.string(),
  limit: z.number().default(10),
  data: getImageInfoDataSchema.optional(),
})