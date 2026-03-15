import { NextRequest, NextResponse } from "next/server"

const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:29612"
const GPU_API_KEY = process.env.GPU_API_KEY || ""

export async function POST(req: NextRequest) {
  try {

    const {
      imageUrl,
      prompt,
      negativePrompt,
      steps = 30,
      ipAdapterScale = 0.6,
      modelId = "cyberrealistic_pony",
    } = await req.json()

    if (!imageUrl || !prompt) {
      return NextResponse.json(
        { error: "Missing imageUrl or prompt" },
        { status: 400 }
      )
    }

    // Call GPU API
    const gpuRes = await fetch(`${GPU_API_URL}/api/v1/ip-adapter/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": GPU_API_KEY,
      },
      body: JSON.stringify({
        reference_image_url: imageUrl,
        prompt: prompt.trim(),
        negative_prompt: negativePrompt?.trim() || undefined,
        steps: parseInt(String(steps)) || 30,
        ip_adapter_scale: parseFloat(String(ipAdapterScale)) || 0.6,
        base_model: modelId,
      }),
    })

    const data = await gpuRes.json()

    if (!gpuRes.ok) {
      console.error("[IP-Adapter API] GPU error:", data)
      return NextResponse.json(
        { error: data.detail || "Generation failed" },
        { status: gpuRes.status }
      )
    }



    return NextResponse.json({
      imageUrl: data.imageUrl,
      model: data.model,
      steps: data.steps,
      cfg: data.cfg,
      ip_adapter_scale: data.ip_adapter_scale,
    })
  } catch (e) {
    console.error("[IP-Adapter API] Error:", e)
    return NextResponse.json(
      { error: "Generation failed: " + String(e) },
      { status: 500 }
    )
  }
}
