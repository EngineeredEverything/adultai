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
  introText: "Hey there... I've been waiting for someone interesting to show up. Tell me — what brings you here?",
}

const FOLLOWUP_RESPONSES = [
  "Mmm, I like the way you think. I'd love to keep exploring this with you, but I'm just a little taste of what's possible. Sign up and get the real me — no limits. 💜",
  "You're making this very hard to keep professional... 😈 Create your account and we can pick up exactly where we left off. No restrictions.",
  "You've unlocked something in me I don't share with just anyone. Sign up — I'll be waiting for you. 💋",
]

export default function DemoChat({ companion }: Props) {
  const char = companion || DEFAULT_COMPANION
  const firstMessage = char.introText || "Hey there... I've been waiting for someone interesting to show up. 😏 Tell me — what brings you here?"

  const [messages, setMessages] = useState<Message[]>([
    { id: "1", role: "assistant", content: firstMessage, timestamp: new Date() },
  ])
  const [input, setInput] = useState("")
  const [messageCount, setMessageCount] = useState(0)
  const [isTyping, setIsTyping] = useState(false)
  const [showIntroVideo, setShowIntroVideo] = useState(!!companion?.introVideoUrl)
  const [isRecording, setIsRecording] = useState(false)
  const [interimText, setInterimText] = useState("")
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Mic state refs (not state to avoid stale closures)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioRef = useRef<HTMLAudioElement | null>(null)
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

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

  // ── Push-to-talk mic ──────────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (isRecording || messageCount >= 3) return

    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SR) {
      // Web Speech API (Chrome/Edge) — continuous mode, stops on pointer up
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
      } catch {
        setIsRecording(false)
      }
    } else {
      // MediaRecorder fallback (Firefox/Safari)
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
      } catch {
        setIsRecording(false)
      }
    }
  }, [isRecording, messageCount, sendContent])

  const stopRecording = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop() } catch {}
      return
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop()
    }
  }, [])

  // Document-level pointerup so releasing anywhere stops recording
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

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* ── Portrait Panel (desktop) ── */}
      <div className="hidden md:block relative w-[36%] lg:w-[32%] flex-shrink-0">
        {char.imageUrl ? (
          showIntroVideo && char.introVideoUrl ? (
            <video
              key={char.introVideoUrl}
              src={char.introVideoUrl}
              autoPlay
              playsInline
              onEnded={() => setShowIntroVideo(false)}
              className="absolute inset-0 w-full h-full object-cover object-top"
            />
          ) : (
            <img src={char.imageUrl} alt={char.name} className="absolute inset-0 w-full h-full object-cover object-top" />
          )
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-pink-900 to-gray-900 flex items-center justify-center">
            <span className="text-8xl">💜</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent" />
        <div className="absolute top-4 right-4">
          <span className="bg-purple-600/80 backdrop-blur-sm text-white text-xs font-medium px-3 py-1 rounded-full">🎭 Demo</span>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <Link href="/companions" className="text-gray-400 hover:text-white transition text-xs flex items-center gap-1 mb-3 w-fit">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            All companions
          </Link>
          <h2 className="text-2xl font-bold">{char.name}</h2>
          <p className="text-sm text-purple-300 mb-1">{char.personality}</p>
          <p className="text-xs text-green-400">● Demo mode</p>
        </div>
      </div>

      {/* ── Chat Panel ── */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="bg-gradient-to-r from-purple-600/90 to-pink-600/90 px-4 py-2 text-center text-xs flex items-center justify-center gap-3 flex-wrap">
          <span className="font-medium">🎭 Demo — {3 - messageCount} messages remaining</span>
          <Link href="/auth/register" className="underline font-medium hover:opacity-80">Sign up for unlimited →</Link>
        </div>

        {/* Mobile portrait */}
        <div className="md:hidden relative h-52 flex-shrink-0">
          {char.imageUrl
            ? <img src={char.imageUrl} alt={char.name} className="absolute inset-0 w-full h-full object-cover object-top" />
            : <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-pink-900" />
          }
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/30 to-transparent" />
          <div className="absolute top-3 left-4">
            <Link href="/companions" className="p-2 rounded-full bg-gray-950/50 backdrop-blur-sm text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
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

          {isLimitReached && (
            <div className="flex justify-center pt-2">
              <div className="bg-gray-900 border border-purple-500/30 rounded-2xl px-6 py-5 max-w-sm text-center w-full">
                <div className="text-2xl mb-2">💜</div>
                <h3 className="font-bold text-lg mb-1">Keep chatting with {char.name}</h3>
                <p className="text-sm text-gray-400 mb-4">Sign up to unlock unlimited messages, voice responses, and 25 more companions.</p>
                <Link href={`/auth/register?from=demo&character=${char.slug}`}
                  className="block w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 py-3 rounded-xl font-semibold transition-all text-sm">
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

        {/* Input area */}
        <div className="border-t border-gray-800/50 bg-gray-950/90 backdrop-blur-sm">

          {/* Recording overlay */}
          {isRecording && (
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-0.5 bg-red-400 rounded-full animate-pulse"
                      style={{ height: `${12 + Math.sin(i * 1.5) * 8}px`, animationDelay: `${i * 120}ms` }} />
                  ))}
                </div>
                <p className="flex-1 text-sm text-white truncate min-w-0">
                  {interimText ? <>&ldquo;{interimText}&rdquo;</> : `Listening — speak to ${char.name}`}
                </p>
                {/* Visible stop button — tap if hold didn't register */}
                <button
                  onClick={stopRecording}
                  className="flex-shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/40 text-red-300 text-xs rounded-lg transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}

          <div className="px-3 py-3">
            <div className="flex items-end gap-2">

              {/* Mic button — visible only when not recording */}
              {!isLimitReached && (
                <button
                  onPointerDown={(e) => { e.preventDefault(); startRecording() }}
                  onPointerUp={stopRecording}
                  onPointerCancel={stopRecording}
                  onPointerLeave={stopRecording}
                  disabled={isLimitReached}
                  className="flex flex-col items-center gap-0.5 flex-shrink-0 select-none touch-none"
                  title={isRecording ? "Release to send" : "Hold to speak"}
                >
                  <div className={`p-2.5 rounded-xl border transition-all ${isRecording ? 'bg-red-900/40 border-red-500 text-red-300 scale-110' : 'bg-gray-900 border-gray-600 text-gray-300 hover:bg-purple-900/30 hover:border-purple-500/60 hover:text-purple-300 active:scale-95 active:bg-purple-900/50 active:border-purple-400'}`}>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                  </div>
                  <span className={`text-[10px] ${isRecording ? 'text-red-400' : 'text-gray-600'}`}>{isRecording ? 'Release' : 'Hold'}</span>
                </button>
              )}

              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isLimitReached ? "Sign up to continue..." : `Message ${char.name}...`}
                rows={1}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none max-h-28 disabled:opacity-50"
                style={{ minHeight: "44px" }}
                disabled={isLimitReached || isRecording}
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || isLimitReached}
                className="bg-gradient-to-r from-purple-600 to-pink-600 p-2.5 rounded-xl transition-all disabled:opacity-40 flex-shrink-0 mb-5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-gray-600 text-center mt-1">
              {isLimitReached
                ? <Link href="/auth/register" className="text-purple-400 hover:text-purple-300">Sign up to continue →</Link>
                : `${3 - messageCount} demo messages left · hold mic to speak`
              }
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
