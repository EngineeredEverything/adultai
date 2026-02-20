import { NextRequest, NextResponse } from "next/server"

const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:29612"
const GPU_API_KEY = process.env.GPU_API_KEY || "Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o"

export async function POST(req: NextRequest) {
  try {
    const { videoUrl, fps = 10, width = 480, duration = 4 } = await req.json()

    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 })
    }

    const gpuRes = await fetch(`${GPU_API_URL}/api/v1/video/to-gif`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": GPU_API_KEY,
      },
      body: JSON.stringify({ video_url: videoUrl, fps, width, duration }),
    })

    if (!gpuRes.ok) {
      const err = await gpuRes.text()
      console.error("[video-to-gif] GPU error:", err)
      return NextResponse.json({ error: "GIF conversion failed" }, { status: 502 })
    }

    const data = await gpuRes.json()
    return NextResponse.json({ gifUrl: data.gif_url, sizeBytes: data.size_bytes })

  } catch (err: any) {
    console.error("[video-to-gif] error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
