"use client"

import { useState, useRef, useEffect } from "react"
import Link from "next/link"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

const DEMO_CHARACTER = {
  name: "Luna",
  personality: "playful",
  appearance: "artistic",
  portraitUrl: "/placeholder.png",
  bio: "A playful AI companion who loves getting to know new people. Try chatting with me!",
}

const DEMO_RESPONSES = [
  "Hey there! 😊 I'm Luna, your demo AI companion. What brings you here today?",
  "That's really interesting! I'd love to chat more, but I'm just a demo. Want to create your own personalized companion? They'll remember everything about you!",
  "I'm having so much fun chatting! 💕 To keep the conversation going and unlock voice & video features, you'll need to sign up. It only takes a minute!",
  "You've reached the demo limit! 😅 Sign up to continue chatting, or create a companion with your perfect personality match!",
]

export default function DemoChat() {
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

  const handleSend = async () => {
    const content = input.trim()
    if (!content || messageCount >= 3) return

    // Add user message
    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content,
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setMessageCount((prev) => prev + 1)

    // Show typing indicator
    setIsTyping(true)

    // Simulate AI response after delay
    setTimeout(() => {
      const responseIndex = Math.min(messageCount + 1, DEMO_RESPONSES.length - 1)
      const aiMsg: Message = {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: DEMO_RESPONSES[responseIndex],
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMsg])
      setIsTyping(false)
    }, 1500)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const isLimitReached = messageCount >= 3

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Demo Banner */}
      <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-4 py-2 text-center text-sm">
        <span className="font-medium">🎭 Demo Mode</span>
        <span className="mx-2">•</span>
        <span className="opacity-90">Limited to 3 messages</span>
        <Link href="/auth/register" className="ml-3 underline font-medium hover:opacity-80">
          Sign up for full access →
        </Link>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <Link href="/companions" className="text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-pink-400 flex items-center justify-center text-lg">
          {DEMO_CHARACTER.name[0]}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{DEMO_CHARACTER.name}</h2>
          <p className="text-xs text-green-400">Demo companion</p>
        </div>

        <Link
          href="/companions/create"
          className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg text-xs font-medium hover:from-purple-700 hover:to-pink-700 transition-all"
        >
          Create Your Own
        </Link>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-purple-600 text-white rounded-br-md"
                  : "bg-gray-800 text-gray-100 rounded-bl-md"
              }`}
            >
              <p className="whitespace-pre-wrap break-words">{msg.content}</p>
              <div className="text-xs mt-1 opacity-50">
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        {/* Demo limit notice */}
        {isLimitReached && (
          <div className="flex justify-center">
            <div className="bg-purple-500/10 border border-purple-500/30 rounded-2xl px-6 py-4 max-w-md text-center">
              <h3 className="font-semibold mb-2">Demo limit reached! 🎭</h3>
              <p className="text-sm text-gray-300 mb-4">
                Want to keep chatting with {DEMO_CHARACTER.name}? Sign up to unlock:
              </p>
              <ul className="text-sm text-left space-y-2 mb-4">
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Unlimited messages</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Create personalized companions</span>
                </li>
                <li className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Voice & video responses</span>
                </li>
              </ul>
              <Link
                href="/auth/register"
                className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 py-3 rounded-xl font-medium transition-all"
              >
                Sign Up Free
              </Link>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 px-4 py-3 bg-gray-950/90 backdrop-blur-sm">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isLimitReached
                ? "Sign up to continue chatting..."
                : `Message ${DEMO_CHARACTER.name}...`
            }
            rows={1}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none max-h-32 disabled:opacity-50"
            style={{ minHeight: "48px" }}
            disabled={isLimitReached}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLimitReached}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 p-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        {/* Message count */}
        <div className="text-xs text-gray-500 mt-2 text-center">
          {isLimitReached ? (
            <span className="text-purple-400 font-medium">Demo complete! Sign up to continue →</span>
          ) : (
            <span>{messageCount}/3 demo messages used</span>
          )}
        </div>
      </div>
    </div>
  )
}
