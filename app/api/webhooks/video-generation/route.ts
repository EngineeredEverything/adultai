import { type NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { logger } from "@/lib/logger"
import { getVideoProvider } from "@/actions/videos/provider"
import { checkVideoStatusRaw } from "@/actions/videos/info"

const provider = getVideoProvider("CUSTOM")
const API_TOKEN = process.env.BOT_API_TOKEN

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

    if (body.status === "success" && body.output && body.output.length > 0) {
      const updatePromises = pendingVideos.map(async (pendingVideo, index) => {
        const videoUrl = index < body.output.length ? body.output[index] : null

        if (!videoUrl) {
          return db.generatedVideo.update({
            where: { id: pendingVideo.id },
            data: {
              status: "failed",
              updatedAt: new Date(),
            },
          })
        }

        try {
          const { path, cdnUrl } = await provider.uploadVideoUrlToCDN(videoUrl, 3)

          return db.generatedVideo.update({
            where: { id: pendingVideo.id },
            data: {
              status: "completed",
              videoUrl: cdnUrl,
              path: path,
              verified: new Date(),
              updatedAt: new Date(),
            },
          })
        } catch (error) {
          logger.debug("Error uploading to CDN:", error)

          return db.generatedVideo.update({
            where: { id: pendingVideo.id },
            data: {
              status: "completed",
              videoUrl: "",
              verified: new Date(),
              updatedAt: new Date(),
            },
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
