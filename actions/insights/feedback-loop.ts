"use server"

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { tokenizePrompt } from "@/lib/prompt-tokenizer"

const MIN_SAMPLE_SIZE = 5

/**
 * Enhance a user's prompt with proven high-scoring fragments.
 * Adds quality boosters (lighting, style, composition terms) that
 * the learning system has found to correlate with high engagement.
 *
 * Doesn't change the user's core intent — just polishes the technical quality.
 */
export async function applyInsightsToPrompt(userPrompt: string): Promise<{
  enhanced: string
  additions: string[]
  original: string
}> {
  const { allFragments } = tokenizePrompt(userPrompt)
  const existingSet = new Set(allFragments)
  const promptLower = userPrompt.toLowerCase()

  // Get top positive fragments
  const topFragments = await db.promptInsight.findMany({
    where: {
      sampleSize: { gte: MIN_SAMPLE_SIZE },
      score: { gt: 2 }, // only clearly positive fragments
      fragment: { notIn: Array.from(existingSet) },
    },
    orderBy: { score: "desc" },
    take: 20,
    select: {
      fragment: true,
      score: true,
    },
  })

  // Filter to fragments that don't overlap with prompt content
  // and limit to 3-5 additions to avoid over-stuffing
  const additions: string[] = []
  for (const f of topFragments) {
    if (additions.length >= 4) break
    if (promptLower.includes(f.fragment)) continue

    // Skip if any word in the fragment is already in the prompt
    const words = f.fragment.split(" ")
    const hasOverlap = words.some(w => w.length > 3 && promptLower.includes(w))
    if (hasOverlap) continue

    additions.push(f.fragment)
  }

  const enhanced = additions.length > 0
    ? `${userPrompt}, ${additions.join(", ")}`
    : userPrompt

  logger.debug("Prompt enhancement", {
    original: userPrompt.substring(0, 50),
    additions,
    enhanced: enhanced.substring(0, 80),
  })

  return { enhanced, additions, original: userPrompt }
}

/**
 * Build a negative prompt from learned downvote patterns.
 * Returns fragments that consistently appear in poorly-rated images.
 */
export async function getNegativePromptFromDownvotes(): Promise<string> {
  const negatives = await db.negativeInsight.findMany({
    where: {
      sampleSize: { gte: MIN_SAMPLE_SIZE },
      downvoteRate: { gt: 0.6 }, // >60% downvote rate
    },
    orderBy: { downvoteRate: "desc" },
    take: 20,
    select: {
      fragment: true,
      downvoteRate: true,
    },
  })

  if (negatives.length === 0) {
    // Return sensible defaults when we don't have enough data yet
    return "blurry, low quality, distorted, deformed, ugly, bad anatomy, bad hands, missing fingers, extra fingers, watermark, text, signature"
  }

  // Combine learned negatives with baseline
  const baseline = "blurry, low quality, distorted, deformed"
  const learned = negatives.map(n => n.fragment).join(", ")

  return `${baseline}, ${learned}`
}

/**
 * Get a complete generation config optimized by learning.
 * Returns enhanced prompt, negative prompt, and tuned parameters.
 */
export async function getOptimizedGenerationConfig(userPrompt: string) {
  const [enhanced, negativePrompt, defaults] = await Promise.all([
    applyInsightsToPrompt(userPrompt),
    getNegativePromptFromDownvotes(),
    db.generationDefault.findMany(),
  ])

  const params: Record<string, number> = {}
  for (const d of defaults) {
    params[d.key] = d.value
  }

  return {
    prompt: enhanced.enhanced,
    promptAdditions: enhanced.additions,
    originalPrompt: enhanced.original,
    negativePrompt,
    parameters: {
      cfg: params.cfg || 6.8,
      steps: params.steps || 42,
      width: params.width || 512,
      height: params.height || 768,
    },
  }
}

/**
 * Analyze a specific user's preferences to personalize suggestions.
 */
export async function getUserPreferenceProfile(userId: string) {
  // Get user's voting history
  const votes = await db.imageVote.findMany({
    where: { userId },
    include: {
      image: {
        select: {
          prompt: true,
          categoryIds: true,
          cfg: true,
          steps: true,
        },
      },
    },
  })

  if (votes.length === 0) return null

  // Analyze upvoted vs downvoted prompt fragments
  const likedFragments = new Map<string, number>()
  const dislikedFragments = new Map<string, number>()

  for (const vote of votes) {
    const { allFragments } = tokenizePrompt(vote.image.prompt)
    const target = vote.voteType === "UPVOTE" ? likedFragments : dislikedFragments

    for (const fragment of allFragments) {
      target.set(fragment, (target.get(fragment) || 0) + 1)
    }
  }

  // Find fragments uniquely liked (liked but not disliked)
  const uniquelyLiked: { fragment: string; count: number }[] = []
  for (const [fragment, count] of likedFragments) {
    if (!dislikedFragments.has(fragment) && count >= 2) {
      uniquelyLiked.push({ fragment, count })
    }
  }
  uniquelyLiked.sort((a, b) => b.count - a.count)

  // Preferred categories
  const categoryScores = new Map<string, number>()
  for (const vote of votes) {
    const weight = vote.voteType === "UPVOTE" ? 1 : -1
    for (const catId of vote.image.categoryIds) {
      categoryScores.set(catId, (categoryScores.get(catId) || 0) + weight)
    }
  }

  const preferredCategories = Array.from(categoryScores.entries())
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([catId, score]) => ({ categoryId: catId, score }))

  return {
    totalVotes: votes.length,
    upvotes: votes.filter(v => v.voteType === "UPVOTE").length,
    downvotes: votes.filter(v => v.voteType === "DOWNVOTE").length,
    topLikedFragments: uniquelyLiked.slice(0, 15),
    preferredCategories: preferredCategories.slice(0, 5),
  }
}
