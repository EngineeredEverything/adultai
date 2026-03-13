import { NextRequest, NextResponse } from "next/server"
import { db } from "@/lib/db"
import { getServerSession } from "next-auth"
import { authOptions } from "@/auth"

const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:29612"
const GPU_API_KEY = process.env.GPU_API_KEY || "Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o"
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ""
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || ""
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "storage-adultai"
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST || "la.storage.bunnycdn.com"
const BUNNY_CDN_URL = process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "https://adultai-com.b-cdn.net"

// Default voice — "Jessica" from ElevenLabs, playful and bright
const DEFAULT_VOICE_ID = "cgSgspJ2msm6clMCkdW9"

async function uploadToBunny(buf: Buffer, ext = "mp3"): Promise<string> {
  const filename = `audio/animate_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const res = await fetch(`https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filename}`, {
    method: "PUT",
    headers: { AccessKey: BUNNY_API_KEY, "Content-Type": ext === "mp3" ? "audio/mpeg" : "video/mp4" },
    body: buf,
  })
  if (!res.ok) throw new Error(`Bunny upload failed: ${res.status}`)
  return `${BUNNY_CDN_URL}/${filename}`
}

export async function POST(req: NextRequest) {
  try {
    const { imageUrl, text, voiceId, isPublic } = await req.json()

    if (!imageUrl || !text?.trim()) {
      return NextResponse.json({ error: "imageUrl and text are required" }, { status: 400 })
    }

    if (text.length > 500) {
      return NextResponse.json({ error: "Text too long (max 500 characters)" }, { status: 400 })
    }

    if (!ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: "TTS not configured" }, { status: 500 })
    }

    const usedVoiceId = voiceId || DEFAULT_VOICE_ID

    // ── Step 1: ElevenLabs TTS ─────────────────────────────────────────────
    const ttsRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${usedVoiceId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text: text.trim(),
        model_id: "eleven_turbo_v2_5",
        voice_settings: { stability: 0.5, similarity_boost: 0.8, style: 0.2 },
      }),
    })

    if (!ttsRes.ok) {
      const err = await ttsRes.text()
      console.error("TTS error:", err)
      return NextResponse.json({ error: "Failed to generate voice" }, { status: 502 })
    }

    const audioBuf = Buffer.from(await ttsRes.arrayBuffer())
    const audioUrl = await uploadToBunny(audioBuf, "mp3")

    // ── Step 2: Wav2Lip talking avatar ─────────────────────────────────────
    const avatarRes = await fetch(`${GPU_API_URL}/api/v1/talking-avatar/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": GPU_API_KEY,
      },
      body: JSON.stringify({
        portrait_url: imageUrl,
        audio_url: audioUrl,
        fps: 25,
        static: true,
      }),
    })

    if (!avatarRes.ok) {
      const err = await avatarRes.text()
      console.error("Avatar error:", err)
      // Return audio-only if avatar fails — still useful
      return NextResponse.json({ audioUrl, videoUrl: null, audioOnly: true })
    }

    const avatarData = await avatarRes.json()
    const videoUrl = avatarData.video_url || null

    // ── Step 3: Save to DB ─────────────────────────────────────────────────
    let videoId: string | null = null
    if (videoUrl) {
      try {
        const session = await getServerSession(authOptions)
        if (session?.user?.email) {
          const dbUser = await db.user.findUnique({ where: { email: session.user.email } })
          if (dbUser) {
            const makePublic = isPublic === true
            const record = await db.generatedVideo.create({
              data: {
                userId: dbUser.id,
                prompt: `Lip sync: ${text.trim().substring(0, 200)}`,
                videoUrl,
                status: "completed",
                isPublic: makePublic,
                costNuts: 0,
                width: 512,
                height: 512,
                verified: makePublic ? new Date() : null,
              },
            })
            videoId = record.id
          }
        }
      } catch (dbErr) {
        console.error("Failed to save lip-sync video to DB:", dbErr)
        // Non-fatal — still return the video
      }
    }

    return NextResponse.json({ audioUrl, videoUrl, audioOnly: !videoUrl, videoId })

  } catch (err: any) {
    console.error("animate-image error:", err)
    return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 })
  }
}
