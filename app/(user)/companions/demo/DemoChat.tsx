"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"

interface DemoCompanion {
  name: string
  slug: string
  personality: string
  imageUrl: string | null
  archetype: string | null
  description: string | null
}

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

interface Props {
  companion: DemoCompanion | null
}

const DEFAULT_COMPANION: DemoCompanion = {
  name: "Luna",
  slug: "luna",
  personality: "Playful & Warm",
  imageUrl: null,
  archetype: "companion",
  description: "A playful AI companion who loves getting to know new people.",
}

const DEMO_RESPONSES = [
  "Hey there... I've been waiting for someone interesting to show up. 😏 Tell me — what brings you here?",
  "Mmm, I like the way you think. I'd love to keep exploring this with you, but I'm just a little taste of what's possible. Sign up and get the real me — no limits. 💜",
  "You're making this very hard to keep professional... 😈 Create your account and we can pick up exactly where we left off. No restrictions.",
  "You've unlocked something in me I don't share with just anyone. Sign up — I'll be waiting for you. 💋",
]

export default function DemoChat({ companion }: Props) {
  const char = companion || DEFAULT_COMPANION
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content: DEMO_RESPONSES[0],
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState("")
  const [messageCount, setMessageCount] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const handleSend = () => {
    const content = input.trim()
    if (!content || messageCount >= 3) return

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setMessageCount((prev) => prev + 1)
    setIsTyping(true)

    setTimeout(() => {
      const idx = Math.min(messageCount + 1, DEMO_RESPONSES.length - 1)
      setMessages((prev) => [
        ...prev,
        { id: `ai-${Date.now()}`, role: "assistant", content: DEMO_RESPONSES[idx], timestamp: new Date() },
      ])
      setIsTyping(false)
    }, 1200)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isLimitReached = messageCount >= 3

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* ── Portrait Panel (desktop) ── */}
      <div className="hidden md:block relative w-[36%] lg:w-[32%] flex-shrink-0">
        {char.imageUrl ? (
          <img
            src={char.imageUrl}
            alt={char.name}
            className="absolute inset-0 w-full h-full object-cover object-top"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
            <span className="text-8xl">💜</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent" />

        {/* Demo badge */}
        <div className="absolute top-4 right-4">
          <span className="bg-purple-600/80 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full">
            🎭 Demo
          </span>
        </div>

        {/* Name at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <Link href="/companions" className="text-gray-400 hover:text-white transition text-xs flex items-center gap-1 mb-3 w-fit">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All companions
          </Link>
          <h2 className="text-2xl font-bold">{char.name}</h2>
          <p className="text-sm text-purple-300 mb-1">{char.personality}</p>
          <p className="text-xs text-green-400">● Demo mode</p>
        </div>
      </div>

      {/* ── Chat Panel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Demo banner */}
        <div className="bg-gradient-to-r from-purple-600/90 to-pink-600/90 px-4 py-2 text-center text-xs flex items-center justify-center gap-3 flex-wrap">
          <span className="font-medium">🎭 Demo — {3 - messageCount} messages remaining</span>
          <Link href="/auth/register" className="underline font-medium hover:opacity-80">
            Sign up for unlimited →
          </Link>
        </div>

        {/* Mobile portrait strip */}
        <div className="md:hidden relative h-52 flex-shrink-0">
          {char.imageUrl ? (
            <img
              src={char.imageUrl}
              alt={char.name}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-pink-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/30 to-transparent" />
          <div className="absolute top-3 left-4">
            <Link href="/companions" className="p-2 rounded-full bg-gray-950/50 backdrop-blur-sm text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <h2 className="font-bold text-lg">{char.name}</h2>
            <p className="text-xs text-green-400">● Demo mode</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && char.imageUrl && (
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-1 ring-1 ring-purple-500/30">
                  <img src={char.imageUrl} alt={char.name} className="w-full h-full object-cover object-top" />
                </div>
              )}
              <div className={`max-w-[78%] flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-br-md"
                    : "bg-gray-800/90 text-gray-100 rounded-bl-md border border-gray-700/30"
                }`}>
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
                <span className="text-xs text-gray-600 px-1">
                  {msg.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {isTyping && (
            <div className="flex gap-2 justify-start">
              {char.imageUrl && (
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-1 ring-1 ring-purple-500/30">
                  <img src={char.imageUrl} alt="" className="w-full h-full object-cover object-top" />
                </div>
              )}
              <div className="bg-gray-800/90 rounded-2xl rounded-bl-md px-4 py-3 border border-gray-700/30">
                <div className="flex gap-1">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Signup CTA when limit reached */}
          {isLimitReached && (
            <div className="flex justify-center pt-2">
              <div className="bg-gray-900 border border-purple-500/30 rounded-2xl px-6 py-5 max-w-sm text-center w-full">
                <div className="text-2xl mb-2">💜</div>
                <h3 className="font-bold text-lg mb-1">Keep chatting with {char.name}</h3>
                <p className="text-sm text-gray-400 mb-4">
                  Sign up to unlock unlimited messages, voice responses, and 25 more companions.
                </p>
                <Link
                  href={`/auth/register?from=demo&character=${char.slug}`}
                  className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3 rounded-xl font-semibold transition-all text-sm"
                >
                  Continue with {char.name} →
                </Link>
                <Link href="/companions/showcase" className="block mt-2 text-xs text-gray-500 hover:text-gray-300 transition">
                  Or browse all 26 companions
                </Link>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-800/50 px-3 py-3 bg-gray-950/90 backdrop-blur-sm">
          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isLimitReached ? "Sign up to continue..." : `Message ${char.name}...`}
              rows={1}
              className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none max-h-28 disabled:opacity-50"
              style={{ minHeight: "44px" }}
              disabled={isLimitReached}
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || isLimitReached}
              className="bg-gradient-to-r from-purple-600 to-pink-600 p-2.5 rounded-xl transition-all disabled:opacity-40 flex-shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
          <p className="text-xs text-gray-600 text-center mt-2">
            {isLimitReached
              ? <Link href="/auth/register" className="text-purple-400 hover:text-purple-300">Sign up to continue →</Link>
              : `${3 - messageCount} demo messages left`
            }
          </p>
        </div>
      </div>
    </div>
  )
}
