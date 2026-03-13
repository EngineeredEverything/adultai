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
  console.log(`[LIPSYNC] called with userIdParam=${userIdParam ?? "undefined"}`)

  // Try passed userId first, fall back to session
  let uid = userIdParam
  if (!uid) {
    const user = await currentUser()
    console.log(`[LIPSYNC] session user=${user?.id ?? "null"}`)
    if (!user) {
      console.log("[LIPSYNC] no user, returning error")
      return { error: "Not authenticated" }
    }
    uid = user.id
  }

  console.log(`[LIPSYNC] querying for userId=${uid}`)

  const videos = await db.generatedVideo.findMany({
    where: {
      userId: uid,
      status: "completed",
      OR: [
        { modelId: "wav2lip" },
        { prompt: { startsWith: "Lip sync" } },
        { prompt: { startsWith: "[Lip Sync]" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  })

  console.log(`[LIPSYNC] found ${videos.length} videos`)

  return { videos: formatVideos(videos) }
}

export async function getUserMotionVideos() {
  // Video/animation tab — excludes lipsync videos (wav2lip modelId or Lip sync prompt prefix)
  const videos = await db.generatedVideo.findMany({
    where: {
      isPublic: true,
      status: "completed",
      NOT: [
        { modelId: "wav2lip" },
        { prompt: { startsWith: "Lip sync" } },
        { prompt: { startsWith: "[Lip Sync]" } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: 60,
  })

  return { videos: formatVideos(videos) }
}
