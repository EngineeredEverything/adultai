import { NextRequest, NextResponse } from "next/server"

const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:29612"
const GPU_API_KEY = process.env.GPU_API_KEY || "Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o"
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || ""
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "storage-adultai"
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST || "la.storage.bunnycdn.com"
const BUNNY_CDN_URL = process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "https://adultai-com.b-cdn.net"

async function uploadToBunny(buf: Buffer, ext = "png"): Promise<string> {
  const filename = `upscaled/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const res = await fetch(`https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filename}`, {
    method: "PUT",
    headers: { AccessKey: BUNNY_API_KEY, "Content-Type": "image/png" },
    body: buf,
  })
  if (!res.ok) throw new Error(`Bunny upload failed: ${res.status}`)
  return `${BUNNY_CDN_URL}/${filename}`
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, scale = 2 } = await req.json()

    if (!imageUrl) return NextResponse.json({ error: "imageUrl is required" }, { status: 400 })
    const scaleFactor = Math.min(Math.max(Number(scale), 2), 4)

    // ── Try GPU API Real-ESRGAN first ─────────────────────────────────────
    try {
      const gpuRes = await fetch(`${GPU_API_URL}/api/v1/upscale`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-API-Key": GPU_API_KEY },
        body: JSON.stringify({ image_url: imageUrl, scale: scaleFactor, enhance: true }),
        signal: AbortSignal.timeout(60000),
      })
      if (gpuRes.ok) {
        const data = await gpuRes.json()
        if (data.image_url) {
          return NextResponse.json({ imageUrl: data.image_url, method: data.method, scale: scaleFactor })
        }
      }
    } catch {
      // GPU endpoint not ready — fall through to server-side upscale
    }

    // ── Server-side upscale via Sharp ────────────────────────────────────
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(15000) })
    if (!imgRes.ok) throw new Error("Failed to fetch source image")
    const srcBuf = Buffer.from(await imgRes.arrayBuffer())

    let outputBuf: Buffer
    try {
      const sharp = (await import("sharp")).default
      const meta = await sharp(srcBuf).metadata()
      const newW = (meta.width ?? 512) * scaleFactor
      const newH = (meta.height ?? 768) * scaleFactor
      outputBuf = await sharp(srcBuf)
        .resize(newW, newH, { kernel: "lanczos3", fastShrinkOnLoad: false })
        .sharpen({ sigma: 1.2, m1: 0.5, m2: 0.3 })
        .png({ compressionLevel: 8 })
        .toBuffer()
    } catch {
      // Sharp not available — return original
      return NextResponse.json({ imageUrl, method: "passthrough", scale: 1 })
    }

    const cdnUrl = await uploadToBunny(outputBuf)
    return NextResponse.json({ imageUrl: cdnUrl, method: "lanczos", scale: scaleFactor })

  } catch (err: any) {
    console.error("[upscale] error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
