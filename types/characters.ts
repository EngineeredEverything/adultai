export interface Character {
  id: string
  userId: string
  name: string
  personality: string
  appearance: string
  description: string | null
  systemPrompt: string | null
  portraitUrl: string | null
  portraitSeed: number | null
  voiceId: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export interface ChatMessage {
  id: string
  characterId: string
  userId: string
  role: "user" | "assistant"
  content: string
  audioUrl: string | null
  videoUrl: string | null
  createdAt: Date
}

export interface CharacterWithCount extends Omit<Character, "systemPrompt" | "userId" | "isActive"> {
  _count: {
    messages: number
  }
}
