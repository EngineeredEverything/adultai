"use server"

import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { tokenizePrompt } from "@/lib/prompt-tokenizer"

const MIN_SAMPLE_SIZE = 5 // Minimum images before a fragment gets a meaningful score

/**
 * Analyze all public completed images with votes.
 * Tokenizes prompts, calculates per-fragment performance metrics,
 * and upserts results into PromptInsight collection.
 */
export async function analyzePromptPerformance() {
  logger.info("Starting prompt performance analysis")

  // Fetch all completed public images that have at least 1 vote
  const images = await db.generatedImage.findMany({
    where: {
      status: "completed",
      isPublic: true,
      OR: [
        { upvotes: { gt: 0 } },
        { downvotes: { gt: 0 } },
      ],
    },
    select: {
      id: true,
      prompt: true,
      upvotes: true,
      downvotes: true,
      voteScore: true,
      categoryIds: true,
    },
  })

  logger.info(`Analyzing ${images.length} voted images`)

  if (images.length === 0) {
    return { analyzed: 0, insights: 0 }
  }

  // Build fragment → performance map
  const fragmentMap = new Map<string, {
    totalVoteScore: number
    totalUpvotes: number
    totalDownvotes: number
    count: number
    categories: Map<string, number>
  }>()

  for (const image of images) {
    const { allFragments } = tokenizePrompt(image.prompt)

    for (const fragment of allFragments) {
      const existing = fragmentMap.get(fragment) || {
        totalVoteScore: 0,
        totalUpvotes: 0,
        totalDownvotes: 0,
        count: 0,
        categories: new Map(),
      }

      existing.totalVoteScore += image.voteScore
      existing.totalUpvotes += image.upvotes
      existing.totalDownvotes += image.downvotes
      existing.count += 1

      // Track category association
      for (const catId of image.categoryIds) {
        existing.categories.set(catId, (existing.categories.get(catId) || 0) + 1)
      }

      fragmentMap.set(fragment, existing)
    }
  }

  // Upsert fragments that meet minimum sample size
  let insightCount = 0
  const upsertOps = []

  for (const [fragment, data] of fragmentMap) {
    if (data.count < MIN_SAMPLE_SIZE) continue

    const avgVoteScore = data.totalVoteScore / data.count
    const totalVotes = data.totalUpvotes + data.totalDownvotes
    const upvoteRate = totalVotes > 0 ? data.totalUpvotes / totalVotes : 0.5

    // Normalized score: combines avg vote score with upvote rate, weighted by confidence
    const confidence = Math.min(data.count / 50, 1) // caps at 50 samples
    const score = (avgVoteScore * 0.6 + upvoteRate * 10 * 0.4) * confidence

    // Find most common category
    let topCategory: string | null = null
    let topCategoryCount = 0
    for (const [catId, catCount] of data.categories) {
      if (catCount > topCategoryCount) {
        topCategory = catId
        topCategoryCount = catCount
      }
    }

    upsertOps.push(
      db.promptInsight.upsert({
        where: { fragment },
        create: {
          fragment,
          score,
          category: topCategory,
          sampleSize: data.count,
          avgVoteScore,
          upvoteRate,
          lastAnalyzedAt: new Date(),
        },
        update: {
          score,
          category: topCategory,
          sampleSize: data.count,
          avgVoteScore,
          upvoteRate,
          lastAnalyzedAt: new Date(),
        },
      })
    )
    insightCount++
  }

  // Execute in batches of 50 to avoid overwhelming MongoDB
  for (let i = 0; i < upsertOps.length; i += 50) {
    await Promise.all(upsertOps.slice(i, i + 50))
  }

  logger.info(`Prompt analysis complete: ${images.length} images → ${insightCount} insights`)
  return { analyzed: images.length, insights: insightCount }
}

/**
 * Analyze which generation parameters (cfg, steps, dimensions) correlate with higher votes.
 */
export async function analyzeParameterPerformance() {
  logger.info("Starting parameter performance analysis")

  const images = await db.generatedImage.findMany({
    where: {
      status: "completed",
      isPublic: true,
      OR: [
        { upvotes: { gt: 0 } },
        { downvotes: { gt: 0 } },
      ],
    },
    select: {
      cfg: true,
      steps: true,
      width: true,
      height: true,
      voteScore: true,
      upvotes: true,
      downvotes: true,
    },
  })

  if (images.length < MIN_SAMPLE_SIZE) {
    logger.info("Not enough voted images to analyze parameters")
    return { analyzed: 0 }
  }

  // For each parameter, bucket values and find the best-performing bucket
  const params: { key: string; extract: (img: any) => number | null }[] = [
    { key: "cfg", extract: (img) => img.cfg },
    { key: "steps", extract: (img) => img.steps },
    { key: "width", extract: (img) => img.width },
    { key: "height", extract: (img) => img.height },
  ]

  const upsertOps = []

  for (const param of params) {
    const buckets = new Map<number, { totalScore: number; count: number }>()

    for (const img of images) {
      const val = param.extract(img)
      if (val == null) continue

      const existing = buckets.get(val) || { totalScore: 0, count: 0 }
      existing.totalScore += img.voteScore
      existing.count += 1
      buckets.set(val, existing)
    }

    // Find best value (minimum 3 samples per bucket)
    let bestValue = 0
    let bestAvg = -Infinity
    let bestSampleSize = 0

    for (const [val, data] of buckets) {
      if (data.count < 3) continue
      const avg = data.totalScore / data.count
      if (avg > bestAvg) {
        bestAvg = avg
        bestValue = val
        bestSampleSize = data.count
      }
    }

    if (bestSampleSize > 0) {
      const confidence = Math.min(bestSampleSize / 30, 1)
      upsertOps.push(
        db.generationDefault.upsert({
          where: { key: param.key },
          create: {
            key: param.key,
            value: bestValue,
            confidence,
            sampleSize: bestSampleSize,
          },
          update: {
            value: bestValue,
            confidence,
            sampleSize: bestSampleSize,
          },
        })
      )
    }
  }

  await Promise.all(upsertOps)

  logger.info(`Parameter analysis complete for ${images.length} images`)
  return { analyzed: images.length }
}

/**
 * Analyze downvoted images to build negative prompt fragments.
 */
export async function analyzeNegativePatterns() {
  logger.info("Starting negative pattern analysis")

  const images = await db.generatedImage.findMany({
    where: {
      status: "completed",
      isPublic: true,
      downvotes: { gt: 0 },
    },
    select: {
      prompt: true,
      upvotes: true,
      downvotes: true,
      voteScore: true,
    },
  })

  if (images.length === 0) return { analyzed: 0, negativeInsights: 0 }

  const fragmentMap = new Map<string, {
    totalDownvotes: number
    totalVotes: number
    count: number
  }>()

  for (const image of images) {
    const { allFragments } = tokenizePrompt(image.prompt)
    const totalVotes = image.upvotes + image.downvotes

    for (const fragment of allFragments) {
      const existing = fragmentMap.get(fragment) || {
        totalDownvotes: 0,
        totalVotes: 0,
        count: 0,
      }
      existing.totalDownvotes += image.downvotes
      existing.totalVotes += totalVotes
      existing.count += 1
      fragmentMap.set(fragment, existing)
    }
  }

  const upsertOps = []
  let negCount = 0

  for (const [fragment, data] of fragmentMap) {
    if (data.count < MIN_SAMPLE_SIZE) continue

    const downvoteRate = data.totalDownvotes / data.totalVotes

    // Only store fragments with >50% downvote rate
    if (downvoteRate <= 0.5) continue

    upsertOps.push(
      db.negativeInsight.upsert({
        where: { fragment },
        create: {
          fragment,
          downvoteRate,
          sampleSize: data.count,
          lastAnalyzedAt: new Date(),
        },
        update: {
          downvoteRate,
          sampleSize: data.count,
          lastAnalyzedAt: new Date(),
        },
      })
    )
    negCount++
  }

  for (let i = 0; i < upsertOps.length; i += 50) {
    await Promise.all(upsertOps.slice(i, i + 50))
  }

  logger.info(`Negative analysis complete: ${images.length} images → ${negCount} negative insights`)
  return { analyzed: images.length, negativeInsights: negCount }
}

/**
 * Get top-performing prompt fragments.
 */
export async function getTopPromptFragments(limit = 50, category?: string) {
  const where: any = {
    sampleSize: { gte: MIN_SAMPLE_SIZE },
  }
  if (category) {
    where.category = category
  }

  return db.promptInsight.findMany({
    where,
    orderBy: { score: "desc" },
    take: limit,
    select: {
      fragment: true,
      score: true,
      category: true,
      sampleSize: true,
      avgVoteScore: true,
      upvoteRate: true,
    },
  })
}

/**
 * Get recommended generation defaults based on vote analysis.
 */
export async function getRecommendedDefaults() {
  const defaults = await db.generationDefault.findMany()
  const result: Record<string, { value: number; confidence: number; sampleSize: number }> = {}
  for (const d of defaults) {
    result[d.key] = { value: d.value, confidence: d.confidence, sampleSize: d.sampleSize }
  }
  return result
}

/**
 * Suggest prompt improvements based on learned insights.
 * Returns high-scoring fragments that aren't already in the prompt.
 */
export async function suggestPromptImprovements(prompt: string, limit = 10) {
  const { allFragments } = tokenizePrompt(prompt)
  const existingSet = new Set(allFragments)

  // Get top fragments the prompt doesn't already contain
  const topFragments = await db.promptInsight.findMany({
    where: {
      sampleSize: { gte: MIN_SAMPLE_SIZE },
      fragment: { notIn: Array.from(existingSet) },
    },
    orderBy: { score: "desc" },
    take: limit * 3, // fetch more, then filter
    select: {
      fragment: true,
      score: true,
      avgVoteScore: true,
    },
  })

  // Filter out fragments that overlap with existing prompt words
  const promptLower = prompt.toLowerCase()
  const suggestions = topFragments
    .filter(f => !promptLower.includes(f.fragment))
    .slice(0, limit)

  return suggestions
}

/**
 * Run full analysis pipeline.
 */
export async function runFullAnalysis() {
  const promptResult = await analyzePromptPerformance()
  const paramResult = await analyzeParameterPerformance()
  const negResult = await analyzeNegativePatterns()

  return {
    prompts: promptResult,
    parameters: paramResult,
    negatives: negResult,
    analyzedAt: new Date().toISOString(),
  }
}
