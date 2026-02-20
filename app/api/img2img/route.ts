import { NextRequest, NextResponse } from "next/server"

const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:29612"
const GPU_API_KEY = process.env.GPU_API_KEY || "Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o"

const QUALITY_SUFFIX = ", masterpiece, best quality, ultra-detailed, photorealistic, 8k"
const NEGATIVE_DEFAULT =
  "deformed, ugly, bad anatomy, bad hands, extra fingers, mutated, poorly drawn face, blurry, watermark, text, logo, lowres, worst quality"

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, prompt, negativePrompt, strength = 0.65, steps = 30, seed } = await req.json()

    if (!imageUrl || !prompt) {
      return NextResponse.json({ error: "imageUrl and prompt are required" }, { status: 400 })
    }

    const res = await fetch(`${GPU_API_URL}/api/v1/img2img`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": GPU_API_KEY },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt: prompt + QUALITY_SUFFIX,
        negative_prompt: negativePrompt || NEGATIVE_DEFAULT,
        strength,
        steps,
        guidance_scale: 7.5,
        seed: seed ?? undefined,
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const err = await res.text()
      // Endpoint not yet deployed on GPU — return clear error
      if (res.status === 404) {
        return NextResponse.json(
          { error: "img2img not yet available — GPU API update required", upgradeRequired: true },
          { status: 503 }
        )
      }
      return NextResponse.json({ error: `GPU error: ${err}` }, { status: 502 })
    }

    const data = await res.json()
    return NextResponse.json({ imageUrl: data.image_url, seed: data.seed })

  } catch (err: any) {
    console.error("[img2img] error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
