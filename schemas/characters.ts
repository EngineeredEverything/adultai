import { z } from "zod"

export const createCharacterSchema = z.object({
  name: z.string().min(1, "Name is required").max(50, "Name must be 50 characters or less"),
  personality: z.enum(["playful", "romantic", "mysterious", "confident", "submissive", "dominant"]),
  appearance: z.enum(["realistic", "artistic", "anime"]),
  description: z.string().max(500).optional(),
})

export const sendMessageSchema = z.object({
  characterId: z.string().min(1, "Character ID is required"),
  content: z.string().min(1, "Message is required").max(2000, "Message must be 2000 characters or less"),
  withVoice: z.boolean().optional().default(false),
  withVideo: z.boolean().optional().default(false),
})

export type CreateCharacterInput = z.infer<typeof createCharacterSchema>
export type SendMessageInput = z.infer<typeof sendMessageSchema>
