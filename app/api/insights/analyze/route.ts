import { NextResponse } from "next/server"
import { runFullAnalysis } from "@/actions/insights/analyze"
import { logger } from "@/lib/logger"

const ADMIN_SECRET = process.env.INSIGHTS_ADMIN_SECRET || process.env.BOT_API_TOKEN || ""

/**
 * POST /api/insights/analyze
 * Triggers the full prompt learning analysis pipeline.
 * Protected by admin secret — meant for cron jobs or admin use.
 */
export async function POST(req: Request) {
  try {
    // Auth check
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token || token !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    logger.info("Insights analysis triggered via API")

    const results = await runFullAnalysis()

    return NextResponse.json({
      success: true,
      results,
    })
  } catch (error: any) {
    logger.error("Insights analysis failed:", error)
    return NextResponse.json(
      { error: error.message || "Analysis failed" },
      { status: 500 }
    )
  }
}

/**
 * GET /api/insights/analyze
 * Returns current analysis status (last run time, counts).
 */
export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get("authorization")
    const token = authHeader?.replace("Bearer ", "")

    if (!token || token !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { db } = await import("@/lib/db")

    const [insightCount, negativeCount, defaults, latestInsight] = await Promise.all([
      db.promptInsight.count(),
      db.negativeInsight.count(),
      db.generationDefault.findMany(),
      db.promptInsight.findFirst({ orderBy: { lastAnalyzedAt: "desc" }, select: { lastAnalyzedAt: true } }),
    ])

    return NextResponse.json({
      insightCount,
      negativeCount,
      defaults: defaults.map(d => ({ key: d.key, value: d.value, confidence: d.confidence })),
      lastAnalyzedAt: latestInsight?.lastAnalyzedAt || null,
    })
  } catch (error: any) {
    logger.error("Insights status check failed:", error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
