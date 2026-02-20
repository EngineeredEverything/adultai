"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"

interface DemoCompanion {
  name: string
  slug: string
  personality: string
  imageUrl: string | null
  archetype: string | null
  description: string | null
  introVideoUrl?: string | null
  introText?: string | null
  voiceId?: string | null
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
  introText: "Hey there... I have been waiting for someone interesting to show up. Tell me — what brings you here?",
}

const FOLLOWUP_RESPONSES = [
  "God, I was just starting to like you... and now the demo is almost up. Sign up and I will pick up exactly where we left off and take it so much further. \ud83d\ude08",
  "You have no idea what I want to say to you right now. Sign up and I will tell you everything. No filter. \ud83d\udc8b",
  "I hate that this is a demo. I was just getting warmed up. Come find me for real \u2014 I promise I am worth it. \ud83d\udd25",
]

export default function DemoChat({ companion }: Props) {
  const char = companion || DEFAULT_COMPANION
  const firstMessage = char.introText || "Hey there... I have been waiting for someone interesting to show up. Tell me \u2014 what brings you here?"

  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: firstMessage, timestamp: new Date() },
  ])
  const [input, setInput] = useState("")
  const [messageCount, setMessageCount] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [showIntroVideo, setShowIntroVideo] = useState(!!companion?.introVideoUrl)
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState("")
  const [showHistory, setShowHistory] = useState(false)

  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showHistory) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, showHistory])

  const sendContent = useCallback(async (content: string) => {
    if (!content.trim() || messageCount >= 3) return
    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content, timestamp: new Date() }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setMessageCount((prev) => prev + 1)
    setIsTyping(true)
    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }))
      history.push({ role: "user", content })
      const res = await fetch("/api/demo/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history,
          companionName: char.name,
          companionPersonality: char.personality,
          companionDescription: char.description,
          voiceId: char.voiceId,
        }),
      })
      const data = await res.json()
      const reply = data.content || FOLLOWUP_RESPONSES[Math.min(messageCount, FOLLOWUP_RESPONSES.length - 1)]
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: "assistant", content: reply, timestamp: new Date() }])
      if (data.audioUrl) {
        if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
        const audio = new Audio(data.audioUrl)
        audioRef.current = audio
        audio.play().catch(() => {})
      }
    } catch {
      const idx = Math.min(messageCount, FOLLOWUP_RESPONSES.length - 1)
      setMessages((prev) => [...prev, { id: `ai-${Date.now()}`, role: "assistant", content: FOLLOWUP_RESPONSES[idx], timestamp: new Date() }])
    } finally {
      setIsTyping(false)
    }
  }, [messageCount, messages, char])

  // Push-to-talk mic
  const startRecording = useCallback(async () => {
    if (isRecording || messageCount >= 3) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      try {
        let accumulated = ""
        const r = new SR()
        recognitionRef.current = r
        r.continuous = true
        r.interimResults = true
        r.lang = "en-US"
        r.onresult = (e: any) => {
          let interim = ""
          for (let i = e.resultIndex; i < e.results.length; i++) {
            const t = e.results[i][0].transcript
            if (e.results[i].isFinal) accumulated += t
            else interim += t
          }
          setInterimText((accumulated + interim).trim())
        }
        r.onerror = (e: any) => {
          if (e.error === "aborted") return
          recognitionRef.current = null
          setIsRecording(false)
          setInterimText("")
        }
        r.onend = () => {
          recognitionRef.current = null
          setIsRecording(false)
          const text = accumulated.trim()
          setInterimText("")
          if (text) sendContent(text)
        }
        r.start()
        setIsRecording(true)
        setInterimText("")
      } catch { setIsRecording(false) }
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg"
        const mr = new MediaRecorder(stream, { mimeType })
        mediaRecorderRef.current = mr
        audioChunksRef.current = []
        mr.ondataavailable = (ev) => { if (ev.data.size > 0) audioChunksRef.current.push(ev.data) }
        mr.onstop = async () => {
          stream.getTracks().forEach((t) => t.stop())
          const blob = new Blob(audioChunksRef.current, { type: mimeType })
          setIsRecording(false)
          mediaRecorderRef.current = null
          if (blob.size < 500) { setInterimText(""); return }
          setInterimText("Transcribing...")
          try {
            const form = new FormData()
            form.append("audio", blob, "audio.webm")
            const res = await fetch("/api/stt", { method: "POST", body: form })
            const data = await res.json()
            if (data.text?.trim()) sendContent(data.text.trim())
          } catch {}
          setInterimText("")
        }
        mr.start()
        setIsRecording(true)
        setInterimText("")
      } catch { setIsRecording(false) }
    }
  }, [isRecording, messageCount, sendContent])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) { try { recognitionRef.current.stop() } catch {} return }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") mediaRecorderRef.current.stop()
  }, [])

  useEffect(() => {
    const onRelease = () => { if (isRecording) stopRecording() }
    document.addEventListener("pointerup", onRelease, { capture: true })
    document.addEventListener("touchend", onRelease, { capture: true })
    return () => {
      document.removeEventListener("pointerup", onRelease, { capture: true })
      document.removeEventListener("touchend", onRelease, { capture: true })
    }
  }, [isRecording, stopRecording])

  const handleSend = () => sendContent(input.trim())
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }
  const isLimitReached = messageCount >= 3

  // Only show last 3 messages in the overlay
  const visibleMessages = messages.slice(-3)

  return (
    <div className="h-dvh w-full relative overflow-hidden bg-black">

      {/* ── Background: Portrait / Intro Video ── */}
      <div className="absolute inset-0">
        {char.imageUrl ? (
          showIntroVideo && char.introVideoUrl ? (
            <video
              key={char.introVideoUrl}
              src={char.introVideoUrl}
              autoPlay
              playsInline
              onEnded={() => setShowIntroVideo(false)}
              className="w-full h-full object-cover object-top"
            />
          ) : (
            <img
              src={char.imageUrl}
              alt={char.name}
              className="w-full h-full object-cover object-top"
            />
          )
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-950 via-pink-950 to-black" />
        )}
      </div>

      {/* ── Top gradient ── */}
      <div className="absolute top-0 left-0 right-0 h-40 bg-gradient-to-b from-black/80 via-black/30 to-transparent pointer-events-none z-10" />

      {/* ── Top overlay: nav + info ── */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2 flex items-center justify-between">
        <Link href="/companions/showcase" className="flex items-center gap-1.5 text-white/80 hover:text-white transition text-sm">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-medium">{char.name}</span>
        </Link>

        <div className="flex items-center gap-2">
          {!isLimitReached && (
            <span className="text-xs text-white/60 bg-black/30 backdrop-blur-sm px-2 py-0.5 rounded-full">
              {3 - messageCount} left
            </span>
          )}
          <span className="text-xs bg-purple-500/80 backdrop-blur-sm text-white px-2.5 py-0.5 rounded-full font-medium">
            Demo
          </span>
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/70 hover:text-white transition"
            title="Chat history"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Full history drawer (slide up) ── */}
      {showHistory && (
        <div
          className="absolute inset-0 z-30 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHistory(false) }}
        >
          <div className="bg-gray-950/95 backdrop-blur-md rounded-t-3xl max-h-[60vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
              <h3 className="font-semibold text-white">Conversation</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 space-y-2 flex-1">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                    msg.role === "user" ? "bg-purple-600 text-white rounded-br-sm" : "bg-gray-800 text-gray-100 rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom gradient ── */}
      <div className="absolute bottom-0 left-0 right-0 h-[55%] bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none z-10" />

      {/* ── Bottom overlay: messages + input ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-2">

        {/* Floating message bubbles */}
        {!isLimitReached && (
          <div className="space-y-1.5 mb-3">
            {visibleMessages.map((msg, i) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                style={{ opacity: i === 0 && visibleMessages.length === 3 ? 0.55 : i === 1 && visibleMessages.length === 3 ? 0.8 : 1 }}
              >
                <div className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed backdrop-blur-sm ${
                  msg.role === "user"
                    ? "bg-purple-600/75 text-white rounded-br-sm"
                    : "bg-black/50 text-white/95 rounded-bl-sm border border-white/10"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}

            {isTyping && (
              <div className="flex justify-start">
                <div className="bg-black/50 backdrop-blur-sm rounded-2xl rounded-bl-sm px-4 py-3 border border-white/10">
                  <div className="flex gap-1 items-center">
                    {[0, 150, 300].map((delay) => (
                      <span key={delay} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Limit reached — signup card */}
        {isLimitReached && (
          <div className="mb-3">
            <div className="bg-black/70 backdrop-blur-md border border-purple-500/30 rounded-2xl px-5 py-4 text-center">
              <div className="text-xl mb-1.5">&#128293;</div>
              <h3 className="font-bold text-base mb-1">{char.name} wants to keep going</h3>
              <p className="text-xs text-gray-400 mb-3">You just got a taste. Sign up and she comes off the leash.</p>
              <Link
                href={`/auth/register?from=demo&character=${char.slug}`}
                className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-2.5 rounded-xl font-bold text-sm transition-all"
              >
                Unlock {char.name} \u2014 Free Signup
              </Link>
              <Link href="/companions/showcase" className="block mt-2 text-xs text-gray-500 hover:text-gray-300 transition">
                Browse all 25 companions
              </Link>
            </div>
          </div>
        )}

        {/* Recording feedback */}
        {isRecording && (
          <div className="mb-2 flex items-center gap-3 bg-red-500/20 backdrop-blur-sm border border-red-500/30 rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-0.5 flex-shrink-0">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="w-0.5 bg-red-400 rounded-full animate-pulse"
                  style={{ height: `${10 + Math.sin(i * 1.5) * 6}px`, animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
            <p className="flex-1 text-sm text-white/90 truncate">
              {interimText ? `"${interimText}"` : `Listening...`}
            </p>
            <button onClick={stopRecording} className="text-xs text-red-300 bg-red-500/20 px-2.5 py-1 rounded-lg">
              Done
            </button>
          </div>
        )}

        {/* Input bar */}
        <div className={`flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-2 transition-opacity ${isLimitReached ? "opacity-40 pointer-events-none" : ""}`}>

          {/* Mic button */}
          <button
            onPointerDown={(e) => { e.preventDefault(); startRecording() }}
            onPointerUp={stopRecording}
            onPointerCancel={stopRecording}
            disabled={isLimitReached}
            className={`flex-shrink-0 p-2 rounded-xl transition-all select-none touch-none ${
              isRecording
                ? "bg-red-500/30 text-red-300"
                : "text-white/60 hover:text-white hover:bg-white/10 active:scale-95"
            }`}
            title="Hold to speak"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </button>

          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isLimitReached ? "Sign up to continue..." : `Message ${char.name}...`}
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-white/40 focus:outline-none resize-none max-h-24"
            style={{ minHeight: "28px" }}
            disabled={isLimitReached || isRecording}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isLimitReached}
            className="flex-shrink-0 p-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white transition-all disabled:opacity-30 active:scale-95"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>

        {!isLimitReached && (
          <p className="text-center text-[11px] text-white/30 mt-1.5">
            {3 - messageCount} messages left \u00b7 hold mic to speak
          </p>
        )}
      </div>
    </div>
  )
}
