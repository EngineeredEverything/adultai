"use client"

import { useState, useRef, useEffect, useTransition } from "react"
import { sendMessage } from "@/actions/characters/chat"
import Link from "next/link"

interface Message {
  id: string
  role: string
  content: string
  audioUrl?: string | null
  videoUrl?: string | null
  createdAt: Date | string
}

interface Character {
  id: string
  name: string
  personality: string
  appearance: string
  portraitUrl: string | null
  voiceId: string | null
}

interface Props {
  character: Character
  initialMessages: Message[]
  userId: string
}

export default function ChatInterface({ character, initialMessages, userId }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [input, setInput] = useState("")
  const [isPending, startTransition] = useTransition()
  const [isTyping, setIsTyping] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [videoEnabled, setVideoEnabled] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  const handleSend = () => {
    const content = input.trim()
    if (!content || isPending) return

    // Add user message immediately
    const userMsg: Message = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    startTransition(async () => {
      const result = await sendMessage({
        characterId: character.id,
        content,
        withVoice: voiceEnabled,
        withVideo: videoEnabled,
      })

      setIsTyping(false)

      if ("error" in result && result.error) {
        // Add error message
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Sorry, I couldn't respond right now. Try again? 💭",
            createdAt: new Date(),
          },
        ])
        return
      }

      if ("message" in result && result.message) {
        setMessages((prev) => [...prev, result.message as Message])
      }
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <Link href="/companions" className="text-gray-400 hover:text-white transition">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden flex-shrink-0">
          {character.portraitUrl ? (
            <img src={character.portraitUrl} alt={character.name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-lg">
              {character.appearance === "anime" ? "🎨" : "📷"}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{character.name}</h2>
          <p className="text-xs text-green-400">Online</p>
        </div>

        {/* Voice/Video toggles */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-2 rounded-lg transition-all ${
              voiceEnabled
                ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title={voiceEnabled ? "Voice responses ON" : "Voice responses OFF"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 016 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>
          <button
            onClick={() => setVideoEnabled(!videoEnabled)}
            className={`p-2 rounded-lg transition-all ${
              videoEnabled
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title={videoEnabled ? "Video responses ON" : "Video responses OFF"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-5xl mb-4">💬</div>
            <p className="text-gray-400">
              Say hello to {character.name}!
            </p>
          </div>
        )}

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

              {/* Audio player */}
              {msg.audioUrl && (
                <div className="mt-2">
                  <audio controls className="w-full h-8" preload="none">
                    <source src={msg.audioUrl} type="audio/mpeg" />
                  </audio>
                </div>
              )}

              {/* Video player */}
              {msg.videoUrl && (
                <div className="mt-2 rounded-lg overflow-hidden">
                  <video
                    controls
                    className="w-full max-w-sm rounded-lg"
                    preload="none"
                    poster={character.portraitUrl || undefined}
                  >
                    <source src={msg.videoUrl} type="video/mp4" />
                  </video>
                </div>
              )}

              <div className="text-xs mt-1 opacity-50">
                {new Date(msg.createdAt).toLocaleTimeString([], {
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

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 px-4 py-3 bg-gray-950/90 backdrop-blur-sm">
        {/* Feature indicators */}
        {(voiceEnabled || videoEnabled) && (
          <div className="flex gap-2 mb-2">
            {voiceEnabled && (
              <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded-full">
                🎙️ Voice
              </span>
            )}
            {videoEnabled && (
              <span className="text-xs bg-pink-500/10 text-pink-400 px-2 py-1 rounded-full">
                🎥 Video
              </span>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${character.name}...`}
            rows={1}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none max-h-32"
            style={{ minHeight: "48px" }}
            disabled={isPending}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isPending}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 p-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
