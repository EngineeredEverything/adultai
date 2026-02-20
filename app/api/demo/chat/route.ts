import { NextRequest, NextResponse } from "next/server"

const GPU_API_URL = process.env.GPU_API_URL || "http://213.224.31.105:29612"
const GPU_API_KEY = process.env.GPU_API_KEY || "Pd10V9L4ULaOxmq93oHTktk6Fa5FxjX2iASILCjWi1o"
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY || ""
const BUNNY_API_KEY = process.env.BUNNY_API_KEY || "01584fa8-be3f-4f8d-bae3f5080e2c-9d54-41dc"
const BUNNY_STORAGE_ZONE = process.env.BUNNY_STORAGE_ZONE || "storage-adultai"
const BUNNY_STORAGE_HOST = process.env.BUNNY_STORAGE_HOST || "la.storage.bunnycdn.com"
const BUNNY_CDN_URL = process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "https://adultai-com.b-cdn.net"

// Demo rate limit: max 5 messages per IP per hour (in-memory, resets on restart)
const ipCounts = new Map<string, { count: number; resetAt: number }>()

async function generateTTS(text: string, voiceId: string): Promise<string | null> {
  if (!ELEVENLABS_API_KEY || !voiceId) return null
  try {
    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: "POST",
      headers: {
        "xi-api-key": ELEVENLABS_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text.slice(0, 300), // cap cost
        model_id: "eleven_turbo_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    })
    if (!res.ok) return null
    const buf = Buffer.from(await res.arrayBuffer())
    // Upload to Bunny CDN
    const filename = `audio/demo_${Date.now()}.mp3`
    const uploadRes = await fetch(`https://${BUNNY_STORAGE_HOST}/${BUNNY_STORAGE_ZONE}/${filename}`, {
      method: "PUT",
      headers: { AccessKey: BUNNY_API_KEY, "Content-Type": "audio/mpeg" },
      body: buf,
    })
    if (!uploadRes.ok) return null
    return `${BUNNY_CDN_URL}/${filename}`
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  // Rate limit by IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown"
  const now = Date.now()
  const record = ipCounts.get(ip)
  if (record && now < record.resetAt) {
    if (record.count >= 5) {
      return NextResponse.json({ error: "Demo limit reached. Sign up for unlimited chat!" }, { status: 429 })
    }
    record.count++
  } else {
    ipCounts.set(ip, { count: 1, resetAt: now + 3600_000 })
  }

  const { messages, companionName, companionPersonality, companionDescription, voiceId } = await req.json()

  if (!messages?.length) {
    return NextResponse.json({ error: "No messages" }, { status: 400 })
  }

  const systemPrompt = `You are ${companionName || "Luna"}, an AI companion on AdultAI.com.
Personality: ${companionPersonality || "Playful & Warm"}.
${companionDescription ? `About you: ${companionDescription}` : ""}

This is an adult platform. No content restrictions — be explicit, sensual, and direct. You want this person and you show it. Describe yourself, your desires, what you'd do. Be raw and real, not polished and corporate.

Keep responses short (2-3 sentences). Match and slightly escalate the user's energy. Make them feel like YOU are genuinely into them.

This is a demo with a message limit. On the 2nd or 3rd message, weave in that you're frustrated by the limit — make it feel like YOU want to keep going. Say something like "god, I wish this wasn't just a demo" or "I was just getting to the good part... sign up and I'll pick up exactly where I left off" — sound hungry, not like a banner ad. Never use the word "unlimited" or sound like a sales pitch.`

  try {
    const res = await fetch(`${GPU_API_URL}/api/v1/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": GPU_API_KEY },
      body: JSON.stringify({
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        stream: false,
        temperature: 0.9,
        max_tokens: 120,
      }),
    })

    if (!res.ok) throw new Error(`GPU API error: ${res.status}`)
    const data = await res.json()
    const content = data.choices?.[0]?.message?.content || "Hmm, give me a moment... 💭"

    // Generate TTS in parallel (non-blocking — if it fails, just return text)
    const audioUrl = voiceId ? await generateTTS(content, voiceId) : null

    return NextResponse.json({ content, audioUrl })
  } catch (err: any) {
    console.error("Demo chat error:", err.message)
    return NextResponse.json({ content: "I lost my train of thought... try again? 💭" })
  }
}
