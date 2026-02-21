import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { getVideoProvider } from "@/actions/videos/provider"
import { checkVideoStatusRaw } from "@/actions/videos/info"
import { uploadBase64VideoToCDN } from "@/lib/custom/video-generation"

const provider = getVideoProvider("CUSTOM")
const API_TOKEN = process.env.BOT_API_TOKEN

/** Returns true if the string looks like raw base64 or a data URI (not a URL) */
function isBase64(str: string): boolean {
  if (!str || typeof str !== "string") return false
  return str.startsWith("data:") || (!str.startsWith("http") && str.length > 200)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    logger.debug("Received video webhook:", body)

    if (!body.id || !body.status) {
      return NextResponse.json({ error: "Invalid webhook data" }, { status: 400 })
    }

    const pendingVideos = await db.generatedVideo.findMany({
      where: {
        taskId: body.id,
        status: { in: ["processing"] },
      },
      select: { id: true, path: true, userId: true },
    })

    if (pendingVideos.length === 0) {
      return NextResponse.json({ error: "No pending videos found with this task ID" }, { status: 404 })
    }
    logger.debug("Fetch status response:", body.output?.length || 0)

    if (body.status === "success" && body.output) {
      // output may be: base64 string, array of base64 strings, or array of URLs
      const outputs: string[] = Array.isArray(body.output) ? body.output : [body.output]

      const updatePromises = pendingVideos.map(async (pendingVideo, index) => {
        const raw = index < outputs.length ? outputs[index] : outputs[0]

        if (!raw) {
          return db.generatedVideo.update({
            where: { id: pendingVideo.id },
            data: { status: "failed", updatedAt: new Date() },
          })
        }

        try {
          let cdnUrl: string
          let path: string

          if (isBase64(raw)) {
            // Strip data URI prefix if present
            const b64 = raw.startsWith("data:") ? raw.split(",")[1] : raw
            const result = await uploadBase64VideoToCDN(b64, 3)
            cdnUrl = result.cdnUrl
            path = result.path
          } else {
            const result = await provider.uploadVideoUrlToCDN(raw, 3)
            cdnUrl = result.cdnUrl
            path = result.path
          }

          return db.generatedVideo.update({
            where: { id: pendingVideo.id },
            data: {
              status: "completed",
              videoUrl: cdnUrl,
              path,
              verified: new Date(),
              updatedAt: new Date(),
            },
          })
        } catch (error) {
          logger.debug("Error uploading video to CDN:", error)
          return db.generatedVideo.update({
            where: { id: pendingVideo.id },
            data: { status: "failed", updatedAt: new Date() },
          })
        }
      })

      await Promise.all(updatePromises)

      return NextResponse.json({ status: "success" })
    } else if (body.status === "processing") {
      if (body.eta) {
        await db.generatedVideo.updateMany({
          where: {
            taskId: body.id,
          },
          data: {
            status: "processing",
            eta: body.eta,
          },
        })
      }

      return NextResponse.json({ status: "processing" })
    } else {
      await db.generatedVideo.updateMany({
        where: {
          taskId: body.id,
        },
        data: {
          status: "failed",
        },
      })

      return NextResponse.json({ status: "failed" })
    }
  } catch (error) {
    logger.debug("Error processing video webhook:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url)
    const taskId = url.searchParams.get("taskId")

    const email = req.headers.get("x-email")
    const password = req.headers.get("x-password")
    const headerToken = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "")

    const token = headerToken

    if (!token || token !== API_TOKEN) {
      logger.warn("Unauthorized access attempt", { token })
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    }

    if (!taskId) {
      return NextResponse.json({ error: "Missing taskId parameter" }, { status: 400 })
    }

    if (!email || !password) {
      return NextResponse.json({ error: "Missing email or password headers" }, { status: 400 })
    }

    let user = await db.user.findUnique({ where: { email } })

    if (!user) {
      logger.info("Creating new bot user", { email })
      user = await db.user.create({
        data: {
          name: "Bot User",
          email,
          password,
          role: "BOT",
        },
      })
      logger.info("Bot user created successfully", { userId: user.id, email })
    }

    if (user.role !== "BOT") {
      logger.error("User is not a bot", { userId: user.id, email, role: user.role })
      throw new Error("User is not a bot")
    }

    if (password !== user.password) {
      logger.error("Invalid credentials for bot user", { userId: user.id, email })
      throw new Error("Invalid credentials")
    }

    logger.info("Bot user authenticated successfully", { userId: user.id, email })

    const pendingVideos = await checkVideoStatusRaw({
      user,
      data: { taskId },
    })

    return NextResponse.json(pendingVideos)
  } catch (error) {
    logger.debug("Error fetching pending videos:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
