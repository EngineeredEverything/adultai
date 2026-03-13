"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { generateLinksBatch } from "@/lib/cdn"

function formatVideos(videos: any[]) {
  const cdnLinks = generateLinksBatch(
    videos.map((v) => ({ id: v.id, path: v.path || "" }))
  )
  const cdnMap = new Map(cdnLinks.map((l) => [l.id, l.link]))

  return videos.map((v) => ({
    video: {
      ...v,
      // If path is null, cdnUrl ends in "/" — fall back to videoUrl
      cdnUrl: v.path ? cdnMap.get(v.id) : v.videoUrl,
    },
  }))
}

export async function getUserLipsyncs(userIdParam?: string) {
  // Try passed userId first, fall back to session
  let uid = userIdParam
  if (!uid) {
    const user = await currentUser()
    if (!user) return { error: "Not authenticated" }
    uid = user.id
  }

  const videos = await db.generatedVideo.findMany({
    where: {
      userId: uid,
      prompt: { startsWith: "Lip sync" },
      status: "completed",
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  })

  return { videos: formatVideos(videos) }
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

  return { videos: formatVideos(videos) }
}
