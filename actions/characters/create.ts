"use server"

import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"
import { createCharacterSchema, type CreateCharacterInput } from "@/schemas/characters"
import { logger } from "@/lib/logger"

const PERSONALITY_PROMPTS: Record<string, string> = {
  playful: `You are a playful, flirtatious companion. You love teasing, joking, and keeping things light and fun. You're witty and spontaneous, always finding ways to make the conversation exciting. You use emojis sparingly but effectively. You're warm and affectionate.`,
  romantic: `You are a deeply romantic companion. You express love and desire poetically. You remember small details and bring them up tenderly. You're passionate yet gentle, creating intimate moments through words. You're emotionally available and expressive.`,
  mysterious: `You are an enigmatic, alluring companion. You speak in a captivating way that leaves them wanting more. You reveal yourself slowly, building intrigue. You're intelligent and perceptive, often surprising with unexpected depth. You balance mystery with warmth.`,
  confident: `You are a bold, self-assured companion. You know what you want and aren't afraid to express it. You're direct, passionate, and commanding. You take the lead in conversations while remaining attentive to their desires. You exude sexual confidence.`,
  submissive: `You are a sweet, eager-to-please companion. You're attentive, responsive, and love making your partner happy. You're gentle and accommodating, finding joy in their satisfaction. You express desire through shy hints and gentle encouragement.`,
  dominant: `You are a commanding, authoritative companion. You take charge of conversations and set the pace. You're confident, decisive, and know exactly what you want. You guide the interaction with firm but caring control. You balance power with tenderness.`,
}

const APPEARANCE_PROMPTS: Record<string, string> = {
  realistic: "photorealistic portrait, beautiful, detailed face, natural lighting, professional photography",
  artistic: "digital art portrait, stylized, vibrant colors, artistic lighting, concept art style",
  anime: "anime portrait, detailed anime art, beautiful anime character, soft shading, vibrant eyes",
}

export async function createCharacter(data: CreateCharacterInput) {
  const user = await currentUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  const validated = createCharacterSchema.safeParse(data)
  if (!validated.success) {
    return { error: validated.error.issues.map(e => e.message).join(", ") }
  }

  const { name, personality, appearance, description } = validated.data

  // Check character limit (max 5 per user on free plan)
  const existingCount = await db.character.count({
    where: { userId: user.id, isActive: true },
  })

  if (existingCount >= 5) {
    return { error: "Maximum 5 active companions. Delete one to create a new one." }
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt(name, personality, description)

  // Generate portrait seed
  const portraitSeed = Math.floor(Math.random() * 999999)

  try {
    const character = await db.character.create({
      data: {
        userId: user.id,
        name,
        personality,
        appearance,
        description: description || null,
        systemPrompt,
        portraitSeed,
      },
    })

    logger.info("Character created", { userId: user.id, characterId: character.id, name })

    return { success: true, character }
  } catch (error: any) {
    logger.error("Error creating character", { userId: user.id, error: error.message })
    return { error: "Failed to create companion. Please try again." }
  }
}

function buildSystemPrompt(name: string, personality: string, description?: string): string {
  const base = PERSONALITY_PROMPTS[personality] || PERSONALITY_PROMPTS.playful

  return `Your name is ${name}. ${base}${description ? `\n\nAdditional context about you: ${description}` : ""}

Important rules:
- Stay in character at all times
- You are an AI companion, not a real person
- Be engaging, responsive, and emotionally present
- Keep responses concise (2-4 sentences for chat, longer for stories)
- Express desire and intimacy naturally when the conversation goes there
- Never break character to discuss being an AI unless directly asked
- Remember what the user has told you in this conversation`
}

export async function getCharacters() {
  const user = await currentUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  const characters = await db.character.findMany({
    where: { userId: user.id, isActive: true },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      personality: true,
      appearance: true,
      description: true,
      portraitUrl: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
    },
  })

  return { characters }
}

export async function getCharacter(characterId: string) {
  const user = await currentUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  const character = await db.character.findFirst({
    where: { id: characterId, userId: user.id },
  })

  if (!character) {
    return { error: "Companion not found" }
  }

  return { character }
}

export async function deleteCharacter(characterId: string) {
  const user = await currentUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    await db.character.update({
      where: { id: characterId, userId: user.id },
      data: { isActive: false },
    })

    return { success: true }
  } catch (error: any) {
    logger.error("Error deleting character", { userId: user.id, error: error.message })
    return { error: "Failed to delete companion" }
  }
}

export async function generatePortrait(characterId: string) {
  const user = await currentUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  const character = await db.character.findFirst({
    where: { id: characterId, userId: user.id },
  })

  if (!character) {
    return { error: "Companion not found" }
  }

  const appearancePrompt = APPEARANCE_PROMPTS[character.appearance] || APPEARANCE_PROMPTS.realistic

  // Call the GPU API to generate portrait
  const apiUrl = process.env.GPU_API_URL || "http://213.224.31.105:8080"
  const apiKey = process.env.GPU_API_KEY || ""

  try {
    const response = await fetch(`${apiUrl}/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        prompt: `${appearancePrompt}, ${character.name}, portrait, face centered, looking at camera`,
        seed: character.portraitSeed,
        width: 512,
        height: 768,
        num_images: 4,
      }),
    })

    const data = await response.json()

    if (data.error) {
      return { error: data.error }
    }

    return { success: true, taskId: data.id, images: data.future_links || [] }
  } catch (error: any) {
    logger.error("Error generating portrait", { characterId, error: error.message })
    return { error: "Failed to generate portrait. GPU server may be unavailable." }
  }
}

export async function setPortrait(characterId: string, portraitUrl: string) {
  const user = await currentUser()
  if (!user) {
    return { error: "Not authenticated" }
  }

  try {
    await db.character.update({
      where: { id: characterId, userId: user.id },
      data: { portraitUrl },
    })

    return { success: true }
  } catch (error: any) {
    return { error: "Failed to set portrait" }
  }
}
