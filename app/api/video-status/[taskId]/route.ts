import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { uploadBase64VideoToCDN, uploadVideoUrlToCDN } from "@/lib/custom/video-generation"
import { currentUser } from "@/utils/auth"

const GPU_API_URL = process.env.AI_VIDEO_BASE_URL || "http://213.224.31.105:29612/api/v1"
const GPU_API_KEY = process.env.GPU_API_KEY || "Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o"

function isBase64(str: string): boolean {
  if (!str || typeof str !== "string") return false
  return str.startsWith("data:") || (!str.startsWith("http") && str.length > 200)
}

async function processAndStorVideo(taskId: string, rawOutput: string): Promise<string> {
  let cdnUrl: string
  let path: string

  if (isBase64(rawOutput)) {
    const b64 = rawOutput.startsWith("data:") ? rawOutput.split(",")[1] : rawOutput
    const result = await uploadBase64VideoToCDN(b64, 3)
    cdnUrl = result.cdnUrl
    path = result.path
  } else {
    const result = await uploadVideoUrlToCDN(rawOutput, 3)
    cdnUrl = result.cdnUrl
    path = result.path
  }

  // Update all pending videos with this taskId
  await db.generatedVideo.updateMany({
    where: { taskId, status: { in: ["processing", "queued"] } },
    data: {
      status: "completed",
      videoUrl: cdnUrl,
      path,
      verified: new Date(),
      updatedAt: new Date(),
    },
  })

  return cdnUrl
}

export async function GET(
  req: NextRequest,
  { params }: { params: { taskId: string } }
) {
  const user = await currentUser()
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { taskId } = params

  try {
    // 1. Check DB first
    const dbVideos = await db.generatedVideo.findMany({
      where: { taskId, userId: user.id },
      select: { id: true, status: true, videoUrl: true, cdnUrl: true },
    })

    if (dbVideos.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 })
    }

    // Already completed or failed — return DB state
    const anyCompleted = dbVideos.some((v) => v.status === "completed")
    const allFailed = dbVideos.every((v) => v.status === "failed")

    if (anyCompleted) {
      const videos = dbVideos.filter((v) => v.status === "completed")
      return NextResponse.json({ status: "completed", videos })
    }

    if (allFailed) {
      return NextResponse.json({ status: "failed" })
    }

    // 2. Still processing — ask GPU API directly
    const fetchUrl = `${GPU_API_URL}/video/fetch-video/${taskId}`
    let gpuData: any = null

    try {
      const gpuRes = await fetch(fetchUrl, {
        headers: { "X-API-Key": GPU_API_KEY },
        signal: AbortSignal.timeout(10000),
      })
      if (gpuRes.ok) {
        gpuData = await gpuRes.json()
      }
    } catch (e) {
      logger.warn("[video-status] GPU poll failed, returning DB status", { taskId })
      return NextResponse.json({ status: "processing", progress: 0 })
    }

    if (!gpuData) {
      return NextResponse.json({ status: "processing", progress: 0 })
    }

    const gpuStatus = gpuData.status
    const progress = gpuData.progress || 0

    if (gpuStatus === "failed" || gpuStatus === "error") {
      await db.generatedVideo.updateMany({
        where: { taskId },
        data: { status: "failed", updatedAt: new Date() },
      })
      return NextResponse.json({ status: "failed" })
    }

    if (gpuStatus === "success" || gpuStatus === "completed") {
      const rawOutput = gpuData.output
      if (!rawOutput) {
        return NextResponse.json({ status: "processing", progress: 99 })
      }

      try {
        const outputs = Array.isArray(rawOutput) ? rawOutput : [rawOutput]
        const cdnUrl = await processAndStorVideo(taskId, outputs[0])
        const updated = await db.generatedVideo.findMany({
          where: { taskId, userId: user.id },
          select: { id: true, status: true, videoUrl: true },
        })
        return NextResponse.json({ status: "completed", videos: updated, cdnUrl })
      } catch (uploadErr) {
        logger.error("[video-status] CDN upload failed", { taskId, error: String(uploadErr) })
        return NextResponse.json({ status: "processing", progress: 99 })
      }
    }

    // Still running
    return NextResponse.json({ status: "processing", progress })

  } catch (err) {
    logger.error("[video-status] Error", { taskId, error: String(err) })
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
