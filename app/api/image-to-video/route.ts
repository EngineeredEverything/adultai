import { NextRequest, NextResponse } from "next/server"

const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:29612"
const GPU_API_KEY = process.env.GPU_API_KEY || "Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { imageUrl, frames = 25, fps = 8, motionStrength = 127, noise = 0 } = body

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 })
    }

    // Download image and convert to base64
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!imgRes.ok) throw new Error("Failed to fetch source image")
    const imgBuf = await imgRes.arrayBuffer()
    const b64 = Buffer.from(imgBuf).toString("base64")

    // Submit to GPU API
    const gpuRes = await fetch(`${GPU_API_URL}/api/v1/video/image-to-video`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": GPU_API_KEY,
      },
      body: JSON.stringify({
        image: b64,
        num_frames: Math.min(frames, 50),
        fps,
        motion_bucket_id: Math.min(Math.max(motionStrength, 1), 255),
        noise_aug_strength: Math.min(Math.max(noise, 0), 1),
      }),
    })

    if (!gpuRes.ok) {
      const err = await gpuRes.text()
      console.error("[image-to-video] GPU error:", err)
      return NextResponse.json({ error: "Video generation failed" }, { status: 502 })
    }

    const data = await gpuRes.json()

    // If async (task_id returned), poll for result
    if (data.task_id) {
      const taskId = data.task_id
      // Poll up to 2 minutes
      for (let i = 0; i < 24; i++) {
        await new Promise((r) => setTimeout(r, 5000))
        const poll = await fetch(`${GPU_API_URL}/api/v1/video/fetch-video/${taskId}`, {
          headers: { "X-API-Key": GPU_API_KEY },
        })
        if (!poll.ok) continue
        const pollData = await poll.json()
        if (pollData.status === "completed" && pollData.video_url) {
          return NextResponse.json({ videoUrl: pollData.video_url })
        }
        if (pollData.status === "failed") {
          return NextResponse.json({ error: "Video generation failed" }, { status: 502 })
        }
      }
      return NextResponse.json({ error: "Timeout waiting for video" }, { status: 504 })
    }

    // Sync response
    if (data.video_url) {
      return NextResponse.json({ videoUrl: data.video_url })
    }

    return NextResponse.json({ error: "No video URL in response" }, { status: 502 })

  } catch (err: any) {
    console.error("[image-to-video] error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
