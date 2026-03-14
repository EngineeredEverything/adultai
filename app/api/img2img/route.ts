import { NextRequest, NextResponse } from "next/server"

const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:29612"
const GPU_API_KEY = process.env.GPU_API_KEY || ""

// Per-model optimal negative prompts
const NEGATIVES: Record<string, string> = {
  cyberrealistic_pony:
    "(worst quality, low quality:1.4), blurry, bad anatomy, extra fingers, extra limbs, poorly drawn hands, deformed, jpeg artifacts, oversharpened, plastic skin, watermark, text, logo, cgi, 3d render, cartoon",
  pony_realism:
    "(worst quality, low quality:1.4), blurry, bad anatomy, extra fingers, deformed, watermark, text, cartoon, plastic skin, overexposed",
  lustify:
    "(worst quality, low quality:1.4), blurry, bad anatomy, deformed, watermark, text, cartoon",
  damn_pony:
    "bad quality, worst quality, low quality, blurry, watermark, text, bad anatomy, deformed",
  pony_diffusion:
    "(worst quality, low quality:1.4), bad anatomy, deformed, watermark, text, censored, blurry",
}

const DEFAULT_NEGATIVE =
  "(worst quality, low quality:1.4), blurry, bad anatomy, extra fingers, extra limbs, deformed, watermark, text, logo, cartoon"

export async function POST(req: NextRequest) {
  try {
    const {
      imageUrl,
      prompt,
      negativePrompt,
      strength = 0.5,
      steps = 30,
      modelId = "cyberrealistic_pony",
      seed,
    } = await req.json()

    if (!imageUrl || !prompt) {
      return NextResponse.json({ error: "imageUrl and prompt are required" }, { status: 400 })
    }

    const negative = negativePrompt?.trim() || NEGATIVES[modelId] || DEFAULT_NEGATIVE

    const res = await fetch(`${GPU_API_URL}/api/v1/img2img`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": GPU_API_KEY,
      },
      body: JSON.stringify({
        image_url: imageUrl,
        prompt,
        negative_prompt: negative,
        strength,
        steps,
        guidance_scale: 6.5,
        model_id: modelId,
        seed: seed ?? undefined,
      }),
      signal: AbortSignal.timeout(120000),
    })

    if (!res.ok) {
      const err = await res.text()
      if (res.status === 404) {
        return NextResponse.json(
          { error: "img2img not available — GPU API update required", upgradeRequired: true },
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
