"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Link from "next/link"

interface Message {
  id: string
  role: string
  content: string
  audioUrl?: string | null
  videoUrl?: string | null
  createdAt: Date | string
  streaming?: boolean
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
  const [isSending, setIsSending] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [sttStatus, setSttStatus] = useState<"idle" | "listening" | "processing">("idle")
  const [interimText, setInterimText] = useState("") // live transcription while speaking
  const [isPlaying, setIsPlaying] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const playAudio = useCallback((url: string) => {
    if (activeAudioRef.current) {
      activeAudioRef.current.pause()
      activeAudioRef.current = null
    }
    const audio = new Audio(url)
    activeAudioRef.current = audio
    setIsPlaying(true)
    audio.onended = () => setIsPlaying(false)
    audio.onerror = () => setIsPlaying(false)
    audio.play().catch(() => setIsPlaying(false))
  }, [])

  // Core send — accepts content directly (from voice or text box)
  const sendContent = useCallback(async (content: string) => {
    if (!content.trim() || isSending) return
    setIsSending(true)

    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date(),
    }
    const streamId = `s-${Date.now()}`
    const streamingMsg: Message = {
      id: streamId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      streaming: true,
    }
    setMessages((prev) => [...prev, userMsg, streamingMsg])

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, content, withVoice: voiceEnabled }),
      })
      if (!res.ok || !res.body) throw new Error("Stream failed")

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ""

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split("\n")
        buffer = lines.pop() || ""

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue
          const raw = line.slice(6).trim()
          if (!raw) continue
          try {
            const event = JSON.parse(raw)
            if (event.token) {
              setMessages((prev) =>
                prev.map((m) => m.id === streamId ? { ...m, content: m.content + event.token } : m)
              )
            }
            if (event.textDone) {
              setMessages((prev) =>
                prev.map((m) => m.id === streamId ? { ...m, streaming: false } : m)
              )
            }
            if (event.audioUrl) {
              setMessages((prev) =>
                prev.map((m) => m.id === streamId ? { ...m, audioUrl: event.audioUrl } : m)
              )
              if (voiceEnabled) playAudio(event.audioUrl)
            }
            if (event.done || event.error) setIsSending(false)
          } catch {}
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId
            ? { ...m, content: "I couldn't respond right now. Try again? 💭", streaming: false }
            : m
        )
      )
      setIsSending(false)
    }
  }, [isSending, character.id, voiceEnabled, playAudio])

  // Text box send
  const handleSend = useCallback(() => {
    const content = input.trim()
    if (!content) return
    setInput("")
    sendContent(content)
  }, [input, sendContent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // ── STT: Browser Web Speech API (free, primary) ──
  const startBrowserSTT = useCallback((): boolean => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return false
    try {
      const r = new SR()
      recognitionRef.current = r
      r.continuous = false
      r.interimResults = true // show live transcription
      r.lang = "en-US"

      r.onresult = (e: any) => {
        let interim = ""
        let final = ""
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const t = e.results[i][0].transcript
          if (e.results[i].isFinal) final += t
          else interim += t
        }
        if (interim) setInterimText(interim)
        if (final) {
          setInterimText("")
          setSttStatus("idle")
          setIsRecording(false)
          recognitionRef.current = null
          // Auto-send immediately — no need to tap send
          sendContent(final)
        }
      }

      r.onerror = (e: any) => {
        setInterimText("")
        if (e.error !== "no-speech") startMediaRecorderSTT()
        else { setSttStatus("idle"); setIsRecording(false) }
      }

      r.onend = () => {
        if (recognitionRef.current === r) {
          recognitionRef.current = null
          setSttStatus("idle")
          setIsRecording(false)
          setInterimText("")
        }
      }

      r.start()
      setSttStatus("listening")
      setIsRecording(true)
      return true
    } catch { return false }
  }, [sendContent])

  // ── STT: MediaRecorder → server (ElevenLabs → Whisper) fallback ──
  const startMediaRecorderSTT = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg"
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }

      recorder.onstop = async () => {
        setSttStatus("processing")
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(audioChunksRef.current, { type: mimeType })
        try {
          const form = new FormData()
          form.append("audio", blob, "audio.webm")
          const res = await fetch("/api/stt", { method: "POST", body: form })
          const data = await res.json()
          if (data.transcript) {
            // Auto-send the transcribed text
            sendContent(data.transcript)
          }
        } catch {}
        setSttStatus("idle")
        setIsRecording(false)
        mediaRecorderRef.current = null
      }

      recorder.start()
      setSttStatus("listening")
      setIsRecording(true)
    } catch {
      setSttStatus("idle")
      setIsRecording(false)
    }
  }, [sendContent])

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      // Stop
      recognitionRef.current?.stop()
      recognitionRef.current = null
      if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
      setSttStatus("idle")
      setIsRecording(false)
      setInterimText("")
      return
    }
    if (!startBrowserSTT()) startMediaRecorderSTT()
  }, [isRecording, startBrowserSTT, startMediaRecorderSTT])

  const statusText = isPlaying ? "🔊 Speaking..." : isSending ? "✍️ Typing..." : isRecording ? "🎤 Listening..." : "● Online"

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* ── Portrait Panel (desktop) ── */}
      <div className="hidden md:block relative w-[36%] lg:w-[32%] flex-shrink-0">
        {character.portraitUrl ? (
          <img src={character.portraitUrl} alt={character.name} className="absolute inset-0 w-full h-full object-cover object-top" />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-pink-900 flex items-center justify-center">
            <span className="text-8xl">💜</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-5">
          <Link href="/companions" className="text-gray-400 hover:text-white text-xs flex items-center gap-1 mb-3 w-fit">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Companions
          </Link>
          <h2 className="text-2xl font-bold">{character.name}</h2>
          <p className="text-sm text-purple-300 mb-1">{character.personality}</p>
          <p className={`text-xs font-medium ${isPlaying ? "text-purple-400" : isSending ? "text-yellow-400" : isRecording ? "text-red-400" : "text-green-400"}`}>
            {statusText}
          </p>
        </div>
      </div>

      {/* ── Chat Panel ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Mobile portrait */}
        <div className="md:hidden relative h-52 flex-shrink-0">
          {character.portraitUrl ? (
            <img src={character.portraitUrl} alt={character.name} className="absolute inset-0 w-full h-full object-cover object-top" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-900 to-pink-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/30 to-transparent" />
          <div className="absolute top-3 left-4 flex items-center gap-3">
            <Link href="/companions" className="p-2 rounded-full bg-gray-950/50 backdrop-blur-sm text-white">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
          </div>
          <div className="absolute top-3 right-4">
            <button
              onClick={() => setVoiceEnabled(!voiceEnabled)}
              className={`p-2 rounded-full backdrop-blur-sm ${voiceEnabled ? "bg-purple-500/70 text-white" : "bg-gray-950/50 text-gray-300"}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
              </svg>
            </button>
          </div>
          <div className="absolute bottom-0 left-0 right-0 px-4 pb-3">
            <h2 className="font-bold text-lg">{character.name}</h2>
            <p className={`text-xs ${isPlaying ? "text-purple-400" : isSending ? "text-yellow-400" : isRecording ? "text-red-400" : "text-green-400"}`}>
              {statusText}
            </p>
          </div>
        </div>

        {/* Desktop controls row */}
        <div className="hidden md:flex items-center justify-end gap-2 px-4 py-2 border-b border-gray-800/50 bg-gray-950/80">
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all ${voiceEnabled ? "bg-purple-500/20 text-purple-300 border border-purple-500/30" : "text-gray-500 hover:text-gray-300"}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
            </svg>
            {voiceEnabled ? "Voice on" : "Voice off"}
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center pb-8 gap-2">
              <p className="text-gray-500 text-sm">Say hello to {character.name} 👋</p>
              <p className="text-gray-600 text-xs">Type a message or tap the mic to speak</p>
            </div>
          )}

          {messages.map((msg) => (
            <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && character.portraitUrl && (
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 mt-1 ring-1 ring-purple-500/30">
                  <img src={character.portraitUrl} alt="" className="w-full h-full object-cover object-top" />
                </div>
              )}
              <div className={`max-w-[78%] flex flex-col gap-0.5 ${msg.role === "user" ? "items-end" : "items-start"}`}>
                <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-br-md"
                    : "bg-gray-800/90 text-gray-100 rounded-bl-md border border-gray-700/30"
                }`}>
                  <p className="whitespace-pre-wrap break-words">
                    {msg.content}
                    {msg.streaming && <span className="inline-block w-0.5 h-4 bg-purple-400 ml-0.5 animate-pulse align-middle" />}
                  </p>
                  {msg.audioUrl && (
                    <button onClick={() => playAudio(msg.audioUrl!)} className="mt-1.5 flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200 transition">
                      <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                      Play voice
                    </button>
                  )}
                </div>
                <span className="text-xs text-gray-600 px-1">
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            </div>
          ))}

          {/* Audio waveform while playing */}
          {isPlaying && (
            <div className="flex justify-start gap-2">
              {character.portraitUrl && (
                <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-purple-500/30">
                  <img src={character.portraitUrl} alt="" className="w-full h-full object-cover object-top" />
                </div>
              )}
              <div className="bg-gray-800/90 rounded-2xl rounded-bl-md px-4 py-3 border border-gray-700/30 flex items-center gap-0.5">
                {[...Array(7)].map((_, i) => (
                  <div key={i} className="w-0.5 bg-purple-400 rounded-full animate-pulse"
                    style={{ height: `${10 + Math.sin(i) * 8}px`, animationDelay: `${i * 100}ms`, animationDuration: `${500 + i * 80}ms` }} />
                ))}
                <span className="text-xs text-purple-400 ml-2">Speaking</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input Area ── */}
        <div className="border-t border-gray-800/50 bg-gray-950/90 backdrop-blur-sm">

          {/* Recording overlay — full-width prominent feedback */}
          {isRecording && (
            <div className="px-4 pt-3 pb-2">
              <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                {/* Animated bars */}
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="w-0.5 bg-red-400 rounded-full animate-pulse"
                      style={{ height: `${12 + Math.sin(i * 1.5) * 8}px`, animationDelay: `${i * 120}ms`, animationDuration: `${400 + i * 100}ms` }} />
                  ))}
                </div>
                <div className="flex-1 min-w-0">
                  {interimText ? (
                    <p className="text-sm text-white truncate">&ldquo;{interimText}&rdquo;</p>
                  ) : (
                    <p className="text-sm text-red-300">
                      {sttStatus === "processing" ? "Processing your voice..." : `Listening — speak to ${character.name}`}
                    </p>
                  )}
                </div>
                <button
                  onClick={handleMicClick}
                  className="flex-shrink-0 px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs rounded-lg transition"
                >
                  Stop
                </button>
              </div>
            </div>
          )}

          <div className="px-3 py-3">
            <div className="flex items-end gap-2">

              {/* Mic button — prominent */}
              <button
                onClick={handleMicClick}
                disabled={sttStatus === "processing" || isSending}
                className={`flex flex-col items-center gap-0.5 flex-shrink-0 transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                  isRecording ? "opacity-0 pointer-events-none" : ""
                }`}
                title="Tap to speak"
              >
                <div className={`p-2.5 rounded-xl border transition-all ${
                  isSending
                    ? "bg-gray-800 border-gray-700 text-gray-600"
                    : "bg-gray-900 border-gray-600 text-gray-300 hover:bg-purple-900/30 hover:border-purple-500/60 hover:text-purple-300 active:scale-95"
                }`}>
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                  </svg>
                </div>
                <span className="text-[10px] text-gray-600">Speak</span>
              </button>

              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={isRecording ? "" : `Message ${character.name}...`}
                rows={1}
                className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/20 transition-all resize-none max-h-28"
                style={{ minHeight: "44px" }}
                disabled={isSending || isRecording}
              />

              <button
                onClick={handleSend}
                disabled={!input.trim() || isSending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 p-2.5 rounded-xl transition-all disabled:opacity-40 flex-shrink-0 mb-5"
              >
                {isSending ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
