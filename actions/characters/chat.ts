"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { sendMessageSchema, type SendMessageInput } from "@/schemas/characters"
import { logger } from "@/lib/logger"

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || ""
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ""
const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:8080"
const GPU_API_KEY = process.env.GPU_API_KEY || ""

export async function sendMessage(data: SendMessageInput) {
  const user = await currentUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  const validated = sendMessageSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues.map(e => e.message).join(", ") }
  }

  const { characterId, content, withVoice, withVideo } = validated.data

  // Get character
  const character = await db.character.findFirst({
    where: { id: characterId, userId: user.id, isActive: true },
  })

  if (!character) {
    return { error: "Companion not found" }
  }

  // Save user message
  await db.chatMessage.create({
    data: {
      characterId,
      userId: user.id,
      role: "user",
      content,
    },
  })

  // Get recent conversation history (last 20 messages)
  const history = await db.chatMessage.findMany({
    where: { characterId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { role: true, content: true },
  })

  // Build messages for AI
  const messages = [
    { role: "system" as const, content: character.systemPrompt || "You are a friendly companion." },
    ...history.reverse().map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
  ]

  try {
    // Generate AI response
    const aiResponse = await generateAIResponse(messages)

    if (!aiResponse) {
      return { error: "Failed to generate response" }
    }

    // Save assistant message
    const assistantMessage = await db.chatMessage.create({
      data: {
        characterId,
        userId: user.id,
        role: "assistant",
        content: aiResponse,
      },
    })

    // Update character's updatedAt
    await db.character.update({
      where: { id: characterId },
      data: { updatedAt: new Date() },
    })

    let audioUrl: string | null = null
    let videoUrl: string | null = null

    // Generate voice if requested
    if (withVoice || withVideo) {
      try {
        audioUrl = await generateTTS(aiResponse, character.voiceId)
        if (audioUrl) {
          await db.chatMessage.update({
            where: { id: assistantMessage.id },
            data: { audioUrl },
          })
        }
      } catch (err: any) {
        logger.error("TTS generation failed", { error: err.message })
      }
    }

    // Generate talking avatar video if requested
    if (withVideo && audioUrl && character.portraitUrl) {
      try {
        videoUrl = await generateTalkingVideo(character.portraitUrl, audioUrl)
        if (videoUrl) {
          await db.chatMessage.update({
            where: { id: assistantMessage.id },
            data: { videoUrl },
          })
        }
      } catch (err: any) {
        logger.error("Video generation failed", { error: err.message })
      }
    }

    return {
      message: {
        id: assistantMessage.id,
        role: "assistant",
        content: aiResponse,
        audioUrl,
        videoUrl,
        createdAt: assistantMessage.createdAt,
      },
    }
  } catch (error: any) {
    logger.error("Chat error", { characterId, userId: user.id, error: error.message })
    return { error: "Failed to generate response. Please try again." }
  }
}

async function generateAIResponse(messages: { role: string; content: string }[]): Promise<string | null> {
  // Try OpenAI first
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          max_tokens: 300,
          temperature: 0.9,
        }),
      })

      const data = await res.json()
      return data.choices?.[0]?.message?.content || null
    } catch (err: any) {
      logger.error("OpenAI API error", { error: err.message })
    }
  }

  // Fallback: basic response
  return "I'm having trouble thinking right now... can you try again in a moment? 💭"
}

async function generateTTS(text: string, voiceId?: string | null): Promise<string | null> {
  if (!ELEVENLABS_API_KEY) {
    logger.warn("ElevenLabs API key not configured")
    return null
  }

  const voice = voiceId || "21m00Tcm4TlvDq8ikWAM" // Default: Rachel

  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "xi-api-key": ELEVENLABS_API_KEY,
      },
      body: JSON.stringify({
        text,
        model_id: "eleven_monolingual_v1",
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
        },
      }),
    })

    if (!res.ok) {
      logger.error("ElevenLabs API error", { status: res.status })
      return null
    }

    // Get audio as buffer and upload to storage
    const audioBuffer = await res.arrayBuffer()
    const audioUrl = await uploadAudioToStorage(Buffer.from(audioBuffer))
    return audioUrl
  } catch (err: any) {
    logger.error("TTS generation error", { error: err.message })
    return null
  }
}

async function uploadAudioToStorage(buffer: Buffer): Promise<string> {
  // For now, save to public directory and serve directly
  // TODO: Upload to Bunny CDN or S3
  const filename = `tts_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.mp3`

  // Use GPU API's storage endpoint or local storage
  // For MVP, we'll use a simple file upload approach
  const fs = await import("fs/promises")
  const path = await import("path")
  const uploadDir = path.join(process.cwd(), "public", "audio")
  await fs.mkdir(uploadDir, { recursive: true })
  await fs.writeFile(path.join(uploadDir, filename), buffer)

  return `/audio/${filename}`
}

async function generateTalkingVideo(portraitUrl: string, audioUrl: string): Promise<string | null> {
  if (!GPU_API_URL) {
    logger.warn("GPU API URL not configured for video generation")
    return null
  }

  try {
    // Call the GPU API's talking avatar endpoint
    // This will need to be implemented on the GPU server (Wav2Lip or SadTalker)
    const res = await fetch(`${GPU_API_URL}/talking-avatar`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${GPU_API_KEY}`,
      },
      body: JSON.stringify({
        portrait_url: portraitUrl,
        audio_url: audioUrl,
      }),
    })

    const data = await res.json()

    if (data.error) {
      logger.error("Talking video generation error", { error: data.error })
      return null
    }

    return data.video_url || null
  } catch (err: any) {
    logger.error("Talking video API error", { error: err.message })
    return null
  }
}

export async function getChatHistory(characterId: string, cursor?: string, limit = 50) {
  const user = await currentUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  // Verify character belongs to user
  const character = await db.character.findFirst({
    where: { id: characterId, userId: user.id },
    select: { id: true },
  })

  if (!character) {
    return { error: "Companion not found" }
  }

  const messages = await db.chatMessage.findMany({
    where: {
      characterId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      role: true,
      content: true,
      audioUrl: true,
      videoUrl: true,
      createdAt: true,
    },
  })

  return {
    messages: messages.reverse(),
    hasMore: messages.length === limit,
    nextCursor: messages.length > 0 ? messages[0].createdAt.toISOString() : null,
  }
}
