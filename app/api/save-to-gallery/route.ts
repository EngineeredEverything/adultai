import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"
import { analyzePromptForCategory } from "@/lib/category-analyzer"

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const user = await db.user.findUnique({ where: { email: session.user.email } })
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const body = await req.json()
    const { id, type, isPublic } = body

    if (!id || !type) {
      return NextResponse.json({ error: "Missing id or type" }, { status: 400 })
    }

    if (type === "video") {
      // If id is a URL (from animate panel which passes videoUrl), find or create the record
      if (id.startsWith("http")) {
        // Check if video already exists in DB
        const existing = await db.generatedVideo.findFirst({
          where: { videoUrl: id, userId: user.id },
        })

        if (existing) {
          // Update visibility
          await db.generatedVideo.update({
            where: { id: existing.id },
            data: { isPublic, verified: isPublic ? new Date() : null },
          })
          return NextResponse.json({ success: true, videoId: existing.id })
        }

        // Create new record
        const video = await db.generatedVideo.create({
          data: {
            userId: user.id,
            prompt: "Animated video",
            videoUrl: id,
            status: "completed",
            isPublic,
            costNuts: 0,
            width: 512,
            height: 768,
            verified: isPublic ? new Date() : null,
          },
        })
        return NextResponse.json({ success: true, videoId: video.id })
      }

      // id is a MongoDB ObjectId — update existing record
      const video = await db.generatedVideo.findFirst({
        where: { id, userId: user.id },
      })

      if (!video) {
        return NextResponse.json({ error: "Video not found" }, { status: 404 })
      }

      await db.generatedVideo.update({
        where: { id },
        data: { isPublic, verified: isPublic ? new Date() : null },
      })

      return NextResponse.json({ success: true, videoId: id })
    }

    if (type === "image") {
      // id is a URL (from img2img or upscale) — create a new image record
      if (id.startsWith("http")) {
        const existing = await db.generatedImage.findFirst({
          where: { imageUrl: id, userId: user.id },
        })

        if (existing) {
          await db.generatedImage.update({
            where: { id: existing.id },
            data: { isPublic, verified: isPublic ? new Date() : null },
          })
          return NextResponse.json({ success: true, imageId: existing.id })
        }

        const image = await db.generatedImage.create({
          data: {
            userId: user.id,
            prompt: "Edited image",
            imageUrl: id,
            status: "completed",
            isPublic,
            costNuts: 0,
            verified: isPublic ? new Date() : null,
          },
        })
        return NextResponse.json({ success: true, imageId: image.id })
      }

      // id is a MongoDB ObjectId
      const image = await db.generatedImage.findFirst({
        where: { id, userId: user.id },
      })

      if (!image) {
        return NextResponse.json({ error: "Image not found" }, { status: 404 })
      }

      await db.generatedImage.update({
        where: { id },
        data: { isPublic, verified: isPublic ? new Date() : null },
      })

      return NextResponse.json({ success: true, imageId: id })
    }

    return NextResponse.json({ error: "Invalid type" }, { status: 400 })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error"
    console.error("[SAVE TO GALLERY]", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
