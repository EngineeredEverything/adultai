import { NextRequest, NextResponse } from "next/server"

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ""
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const audioFile = formData.get("audio") as File | null

    if (!audioFile) {
      return NextResponse.json({ error: "No audio file provided" }, { status: 400 })
    }

    const audioBuffer = Buffer.from(await audioFile.arrayBuffer())

    // Try ElevenLabs STT first
    if (ELEVENLABS_API_KEY) {
      try {
        const transcript = await transcribeWithElevenLabs(audioBuffer, audioFile.type || "audio/webm")
        if (transcript) {
          return NextResponse.json({ transcript, provider: "elevenlabs" })
        }
      } catch (err) {
        console.warn("ElevenLabs STT failed, trying Whisper:", err)
      }
    }

    // Fall back to OpenAI Whisper
    if (OPENAI_API_KEY) {
      try {
        const transcript = await transcribeWithWhisper(audioBuffer, audioFile.type || "audio/webm")
        if (transcript) {
          return NextResponse.json({ transcript, provider: "whisper" })
        }
      } catch (err) {
        console.warn("OpenAI Whisper failed:", err)
      }
    }

    return NextResponse.json({ error: "All STT providers failed" }, { status: 500 })
  } catch (err: any) {
    console.error("STT route error:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

async function transcribeWithElevenLabs(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
  const form = new FormData()
  const blob = new Blob([audioBuffer], { type: mimeType })
  form.append("file", blob, "audio.webm")
  form.append("model_id", "scribe_v1")

  const res = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
    method: "POST",
    headers: {
      "xi-api-key": ELEVENLABS_API_KEY,
    },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`ElevenLabs STT error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.text || null
}

async function transcribeWithWhisper(audioBuffer: Buffer, mimeType: string): Promise<string | null> {
  const form = new FormData()
  const blob = new Blob([audioBuffer], { type: mimeType })
  form.append("file", blob, "audio.webm")
  form.append("model", "whisper-1")
  form.append("language", "en")

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: form,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`OpenAI Whisper error: ${res.status} ${err}`)
  }

  const data = await res.json()
  return data.text || null
}
