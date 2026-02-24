import { NextResponse } from "next/server"
import { getTopPromptFragments, getRecommendedDefaults } from "@/actions/insights/analyze"
import { getNegativePromptFromDownvotes } from "@/actions/insights/feedback-loop"
import { logger } from "@/lib/logger"

const BOT_API_TOKEN = process.env.BOT_API_TOKEN || ""

/**
 * GET /api/bot/prompt-suggestions
 * Returns learned prompt fragments and negative prompts for the Discord bot.
 * The bot calls this before generating images to get optimized prompts.
 *
 * Query params:
 *   - limit: number of top fragments (default 30)
 *   - category: optional category filter
 */
export async function GET(req: Request) {
  try {
    // Auth check
    const { searchParams } = new URL(req.url)
    const token = req.headers.get("authorization")?.replace("Bearer ", "") ||
                  searchParams.get("token")

    if (!token || token !== BOT_API_TOKEN) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const limit = parseInt(searchParams.get("limit") || "30")
    const category = searchParams.get("category") || undefined

    const [topFragments, negativePrompt, defaults] = await Promise.all([
      getTopPromptFragments(limit, category),
      getNegativePromptFromDownvotes(),
      getRecommendedDefaults(),
    ])

    // Group fragments by score tiers for the bot
    const tiers = {
      excellent: topFragments.filter(f => f.score > 5),
      good: topFragments.filter(f => f.score > 2 && f.score <= 5),
      decent: topFragments.filter(f => f.score <= 2),
    }

    return NextResponse.json({
      fragments: topFragments,
      tiers,
      negativePrompt,
      recommendedDefaults: defaults,
      generatedAt: new Date().toISOString(),
    })
  } catch (error: any) {
    logger.error("Error fetching prompt suggestions:", error)
    return NextResponse.json(
      { error: error.message || "Failed to fetch suggestions" },
      { status: 500 }
    )
  }
}
