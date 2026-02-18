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
    seed: z.string().optional(),
    modelId: z.string(),
    steps: z.number().min(10).max(150),
    cfg: z.number().min(1).max(20),
    sampler: z.string(),
    width: z.number().min(64).max(2048),
    height: z.number().min(64).max(2048),
    loraModel: z.string().optional(),
    count: z.number().min(1).max(10),
    loraStrength: z.number().min(0).max(1).optional(),
    enhanceStyle: z.string().optional(),
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