"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { generateLinksBatch } from "@/lib/cdn"

export async function getUserLipsyncs() {
  const user = await currentUser()
  if (!user) return { error: "Not authenticated" }

  const videos = await db.generatedVideo.findMany({
    where: {
      userId: user.id,
      prompt: { startsWith: "Lip sync" },
      status: "completed",
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  })

  const cdnLinks = generateLinksBatch(
    videos.map((v) => ({ id: v.id, path: v.path || "" }))
  )
  const cdnMap = new Map(cdnLinks.map((l) => [l.id, l.link]))

  return {
    videos: videos.map((v) => ({
      video: {
        ...v,
        // If path is null, cdnUrl will be the base domain — fall back to videoUrl
        cdnUrl: v.path ? cdnMap.get(v.id) : v.videoUrl,
      },
    })),
  }
}

export async function getUserMotionVideos() {
  // Reserved for future animated video feature — shows non-lipsync public videos
  const videos = await db.generatedVideo.findMany({
    where: {
      isPublic: true,
      status: "completed",
      NOT: { prompt: { startsWith: "Lip sync" } },
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  })

  const cdnLinks = generateLinksBatch(
    videos.map((v) => ({ id: v.id, path: v.path || "" }))
  )
  const cdnMap = new Map(cdnLinks.map((l) => [l.id, l.link]))

  return {
    videos: videos.map((v) => ({
      video: {
        ...v,
        cdnUrl: v.path ? cdnMap.get(v.id) : v.videoUrl,
      },
    })),
  }
}
