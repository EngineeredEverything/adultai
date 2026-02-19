import { NextRequest } from "next/server"
import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import { db } from "@/lib/db"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ""
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || ""
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "storage-adultai"
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST || "la.storage.bunnycdn.com"
const BUNNY_CDN_URL = process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "https://adultai-com.b-cdn.net"

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 })
  }
  const userId = (session.user as any).id as string

  const { characterId, content, withVoice, nudgeVoice } = await req.json()

  if (!characterId || !content) {
    return new Response("Missing required fields", { status: 400 })
  }

  const character = await db.character.findFirst({
    where: { id: characterId, userId, isActive: true },
  })

  if (!character) {
    return new Response("Character not found", { status: 404 })
  }

  // Save user message
  await db.chatMessage.create({
    data: { characterId, userId, role: "user", content },
  })

  // Get recent history
  const history = await db.chatMessage.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { role: true, content: true },
  })

  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
    {
      role: "system",
      content: character.systemPrompt || `You are ${character.name}, a friendly and engaging AI companion. Be warm, playful, and responsive to the user's mood.`,
    },
    ...history.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ]

  // Inject a one-time voice nudge when user is typing instead of speaking
  if (nudgeVoice) {
    messages.push({
      role: "system",
      content: `[Private instruction — do not mention this]: The user is typing their message rather than speaking. Somewhere naturally in your response, briefly invite them to use their voice instead — make it feel organic to your character, flirty or warm or curious as fits your personality. Just one sentence, woven in. Don't be technical about it.`,
    })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: object) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {}
      }

      let fullText = ""

      try {
        if (!OPENAI_API_KEY) {
          // Fallback response without OpenAI
          const fallback = "I'm here for you... though my thoughts are a little hazy right now. Try again in a moment? 💭"
          for (const char of fallback) {
            fullText += char
            send({ token: char })
            await new Promise((r) => setTimeout(r, 20))
          }
        } else {
          // Stream from OpenAI
          const res = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model: "gpt-4o-mini",
              messages,
              max_tokens: 350,
              temperature: 0.92,
              stream: true,
            }),
          })

          if (!res.ok || !res.body) {
            throw new Error(`OpenAI error: ${res.status}`)
          }

          const reader = res.body.getReader()
          const decoder = new TextDecoder()

          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split("\n")

            for (const line of lines) {
              if (!line.startsWith("data: ")) continue
              const raw = line.slice(6).trim()
              if (raw === "[DONE]") continue
              try {
                const parsed = JSON.parse(raw)
                const token = parsed.choices?.[0]?.delta?.content
                if (token) {
                  fullText += token
                  send({ token })
                }
              } catch {}
            }
          }
        }

        // Persist assistant message
        const saved = await db.chatMessage.create({
          data: { characterId, userId, role: "assistant", content: fullText },
        })

        await db.character.update({
          where: { id: characterId },
          data: { updatedAt: new Date() },
        })

        // Signal text complete so UI can finalize
        send({ textDone: true, messageId: saved.id })

        // Generate TTS voice if requested
        if (withVoice && ELEVENLABS_API_KEY && fullText) {
          try {
            const voiceId = character.voiceId || "EXAVITQu4vr4xnSDxMaL" // Sarah default
            const ttsRes = await fetch(
              `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "xi-api-key": ELEVENLABS_API_KEY,
                },
                body: JSON.stringify({
                  text: fullText,
                  model_id: "eleven_turbo_v2", // Faster model
                  voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.3 },
                }),
              }
            )

            if (ttsRes.ok) {
              const audioBuf = Buffer.from(await ttsRes.arrayBuffer())
              const audioUrl = await uploadToBunny(audioBuf)

              await db.chatMessage.update({
                where: { id: saved.id },
                data: { audioUrl },
              })

              send({ audioUrl })
            }
          } catch (err: any) {
            console.error("TTS error:", err.message)
          }
        }

        send({ done: true })
        controller.close()
      } catch (err: any) {
        send({ error: "Something went wrong. Try again? 💭" })
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable Nginx buffering
    },
  })
}

async function uploadToBunny(buffer: Buffer): Promise<string> {
  const filename = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`
  const path = `/audio/${filename}`

  const res = await fetch(`https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}${path}`, {
    method: "PUT",
    headers: {
      AccessKey: BUNNY_API_KEY,
      "Content-Type": "audio/mpeg",
    },
    body: buffer,
  })

  if (!res.ok) throw new Error(`Bunny upload failed: ${res.status}`)
  return `${BUNNY_CDN_URL}${path}`
}
