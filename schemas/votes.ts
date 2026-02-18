
import * as z from "zod";

// Vote stats schema
export const voteStatsSchema = z.object({
  upvotes: z.number(),
  downvotes: z.number(),
  voteScore: z.number(),
  totalVotes: z.number(),
  upvotePercentage: z.number(),
  userVote: z.enum(["UPVOTE", "DOWNVOTE"]).nullable(),
})

// Vote info schema
export const getImageVotesDataSchema = z.object({
  count: z.boolean().optional(),
  limit: z
    .object({
      start: z.number(),
      end: z.number(),
    })
    .optional(),
  includeUserVotes: z.boolean().optional(),
})

// Vote type schema
export const voteTypeSchema = z.enum(["UPVOTE", "DOWNVOTE"])

// Create vote schema
export const createVoteSchema = z.object({
  imageId: z.string(),
  voteType: voteTypeSchema,
})
