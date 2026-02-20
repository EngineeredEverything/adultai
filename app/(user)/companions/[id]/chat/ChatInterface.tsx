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
  const [inputMode, setInputMode] = useState<"text" | "voice">("text")
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [isRecording, setIsRecording] = useState(false)
  const [sttStatus, setSttStatus] = useState<"idle" | "listening" | "processing">("idle")
  const [interimText, setInterimText] = useState("")
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentVideoUrl, setCurrentVideoUrl] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const typedCountRef = useRef(0)

  const shouldAutoPlayAudio = inputMode === "voice" || voiceEnabled

  useEffect(() => {
    if (showHistory) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, showHistory])

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

  const sendContent = useCallback(async (content: string, source: "text" | "voice" = "text") => {
    if (!content.trim() || isSending) return
    setIsSending(true)

    if (source === "voice") setInputMode("voice")
    else typedCountRef.current += 1

    const userMsg: Message = { id: `u-${Date.now()}`, role: "user", content, createdAt: new Date() }
    const streamId = `s-${Date.now()}`
    const streamingMsg: Message = { id: streamId, role: "assistant", content: "", createdAt: new Date(), streaming: true }
    setMessages((prev) => [...prev, userMsg, streamingMsg])

    const nudgeVoice = source === "text" && typedCountRef.current <= 2
    const autoPlayAudio = source === "voice" || voiceEnabled

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ characterId: character.id, content, withVoice: autoPlayAudio, nudgeVoice }),
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
              setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, content: m.content + event.token } : m))
            }
            if (event.textDone) {
              setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, streaming: false } : m))
            }
            if (event.audioUrl) {
              setMessages((prev) => prev.map((m) => m.id === streamId ? { ...m, audioUrl: event.audioUrl } : m))
              if (autoPlayAudio) playAudio(event.audioUrl)
            }
            if (event.videoUrl) setCurrentVideoUrl(event.videoUrl)
            if (event.done || event.error) setIsSending(false)
          } catch {}
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === streamId ? { ...m, content: "I could not respond right now. Try again? \ud83d\udcad", streaming: false } : m
        )
      )
      setIsSending(false)
    }
  }, [isSending, character.id, voiceEnabled, playAudio])

  const handleSend = useCallback(() => {
    const content = input.trim()
    if (!content) return
    setInput("")
    sendContent(content, "text")
  }, [input, sendContent])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() }
  }

  // Browser STT (auto-stop on silence)
  const startBrowserSTT = useCallback((): boolean => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return false
    try {
      const r = new SR()
      recognitionRef.current = r
      r.continuous = false
      r.interimResults = true
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
          sendContent(final, "voice")
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

  // Push-to-talk STT
  const startBrowserSTTPTT = useCallback((): boolean => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return false
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
        setInterimText(accumulated + interim)
      }
      r.onend = () => {
        recognitionRef.current = null
        setSttStatus("idle")
        setIsRecording(false)
        setInterimText("")
        if (accumulated.trim()) sendContent(accumulated.trim(), "voice")
      }
      r.onerror = (e: any) => {
        if (e.error !== "aborted") { setSttStatus("idle"); setIsRecording(false); setInterimText("") }
      }
      r.start()
      setSttStatus("listening")
      setIsRecording(true)
      return true
    } catch { return false }
  }, [sendContent])

  // MediaRecorder fallback
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
          if (data.transcript) sendContent(data.transcript, "voice")
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

  const handleMicPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    if (isRecording) return
    if (!startBrowserSTTPTT()) startMediaRecorderSTT()
  }, [isRecording, startBrowserSTTPTT, startMediaRecorderSTT])

  const handleMicPointerUp = useCallback(() => {
    recognitionRef.current?.stop()
    recognitionRef.current = null
    if (mediaRecorderRef.current?.state !== "inactive") mediaRecorderRef.current?.stop()
  }, [])

  // Last 4 messages for the overlay
  const visibleMessages = messages.slice(-4)

  const statusDot = isPlaying
    ? { color: "bg-purple-400", label: "Speaking" }
    : isSending
    ? { color: "bg-yellow-400", label: "Typing..." }
    : isRecording
    ? { color: "bg-red-400", label: "Listening" }
    : { color: "bg-green-400", label: "Online" }

  return (
    <div className="h-dvh w-full relative overflow-hidden bg-black">

      {/* ── Background: Portrait or Talking Avatar Video ── */}
      <div className="absolute inset-0 bg-black">
        {character.portraitUrl ? (
          <>
            {/* Blurred background fill (covers letterbox areas) */}
            <img
              src={character.portraitUrl}
              alt=""
              aria-hidden="true"
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl opacity-50"
            />
            {/* Full-body portrait or talking avatar */}
            {currentVideoUrl ? (
              <video
                key={currentVideoUrl}
                src={currentVideoUrl}
                autoPlay
                playsInline
                onEnded={() => setCurrentVideoUrl(null)}
                className="absolute inset-0 w-full h-full object-contain"
              />
            ) : (
              <img
                src={character.portraitUrl}
                alt={character.name}
                className="absolute inset-0 w-full h-full object-contain"
              />
            )}
          </>
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-purple-950 via-pink-950 to-black" />
        )}
      </div>

      {/* ── Top gradient ── */}
      <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-black/85 via-black/30 to-transparent pointer-events-none z-10" />

      {/* ── Top overlay ── */}
      <div className="absolute top-0 left-0 right-0 z-20 px-4 pt-4 pb-2 flex items-center justify-between gap-2">
        {/* Left: back + name */}
        <Link href="/companions" className="flex items-center gap-1.5 text-white/80 hover:text-white transition min-w-0">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="font-semibold text-sm truncate">{character.name}</span>
        </Link>

        {/* Right: status + controls */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Status dot */}
          <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm rounded-full px-2.5 py-1">
            <span className={`w-1.5 h-1.5 rounded-full ${statusDot.color} ${isPlaying || isSending || isRecording ? "animate-pulse" : ""}`} />
            <span className="text-xs text-white/80">{statusDot.label}</span>
          </div>

          {/* Voice toggle */}
          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className={`p-1.5 rounded-full backdrop-blur-sm transition-all ${voiceEnabled ? "bg-purple-500/70 text-white" : "bg-black/30 text-white/50"}`}
            title={voiceEnabled ? "Voice on" : "Voice off"}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
            </svg>
          </button>

          {/* History toggle */}
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="p-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white/70 hover:text-white transition"
            title="Full conversation"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Full history drawer ── */}
      {showHistory && (
        <div
          className="absolute inset-0 z-30 flex flex-col justify-end"
          onClick={(e) => { if (e.target === e.currentTarget) setShowHistory(false) }}
        >
          <div className="bg-gray-950/96 backdrop-blur-md rounded-t-3xl max-h-[65vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 flex-shrink-0">
              <h3 className="font-semibold text-white">{character.name}</h3>
              <button onClick={() => setShowHistory(false)} className="text-gray-400 hover:text-white transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="overflow-y-auto px-4 py-3 space-y-2 flex-1">
              {messages.length === 0 && (
                <p className="text-gray-500 text-sm text-center py-8">Say hello to {character.name}</p>
              )}
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  {msg.role === "assistant" && character.portraitUrl && (
                    <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 mt-1 ring-1 ring-purple-500/30">
                      <img src={character.portraitUrl} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                    msg.role === "user" ? "bg-purple-600 text-white rounded-br-sm" : "bg-gray-800 text-gray-100 rounded-bl-sm"
                  }`}>
                    <p className="whitespace-pre-wrap break-words">
                      {msg.content}
                      {msg.streaming && <span className="inline-block w-0.5 h-3.5 bg-purple-400 ml-0.5 animate-pulse align-middle" />}
                    </p>
                    {msg.audioUrl && (
                      <button
                        onClick={() => playAudio(msg.audioUrl!)}
                        className="mt-1.5 flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200 transition"
                      >
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z" /></svg>
                        Play
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {isPlaying && (
                <div className="flex justify-start gap-2">
                  {character.portraitUrl && (
                    <div className="w-6 h-6 rounded-full overflow-hidden flex-shrink-0 ring-1 ring-purple-500/30">
                      <img src={character.portraitUrl} alt="" className="w-full h-full object-cover object-top" />
                    </div>
                  )}
                  <div className="bg-gray-800 rounded-2xl rounded-bl-sm px-3 py-2.5 flex items-center gap-0.5">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="w-0.5 bg-purple-400 rounded-full animate-pulse"
                        style={{ height: `${8 + Math.sin(i) * 6}px`, animationDelay: `${i * 100}ms` }} />
                    ))}
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* ── Bottom gradient ── */}
      <div className="absolute bottom-0 left-0 right-0 h-[52%] bg-gradient-to-t from-black/95 via-black/70 to-transparent pointer-events-none z-10" />

      {/* ── Bottom overlay: messages + input ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 pb-4 pt-2">

        {/* Floating message bubbles (last 4) */}
        <div className="space-y-1.5 mb-3">
          {visibleMessages.map((msg, i) => {
            const opacity = visibleMessages.length >= 4 && i === 0 ? 0.45
              : visibleMessages.length >= 3 && i === 0 ? 0.6
              : visibleMessages.length >= 4 && i === 1 ? 0.7
              : 1
            return (
              <div
                key={msg.id}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                style={{ opacity }}
              >
                <div className={`max-w-[82%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed backdrop-blur-sm ${
                  msg.role === "user"
                    ? "bg-purple-600/75 text-white rounded-br-sm"
                    : "bg-black/55 text-white/95 rounded-bl-sm border border-white/10"
                }`}>
                  <p className="whitespace-pre-wrap break-words">
                    {msg.content}
                    {msg.streaming && <span className="inline-block w-0.5 h-3.5 bg-purple-400 ml-0.5 animate-pulse align-middle" />}
                  </p>
                </div>
              </div>
            )
          })}

          {/* Typing indicator */}
          {isSending && !messages[messages.length - 1]?.streaming && (
            <div className="flex justify-start">
              <div className="bg-black/55 backdrop-blur-sm rounded-2xl rounded-bl-sm px-4 py-3 border border-white/10">
                <div className="flex gap-1 items-center">
                  {[0, 150, 300].map((delay) => (
                    <span key={delay} className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: `${delay}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Speaking waveform */}
          {isPlaying && (
            <div className="flex justify-start">
              <div className="bg-black/55 backdrop-blur-sm rounded-2xl rounded-bl-sm px-4 py-2.5 border border-purple-500/30 flex items-center gap-0.5">
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="w-0.5 bg-purple-400 rounded-full animate-pulse"
                    style={{ height: `${8 + Math.sin(i) * 6}px`, animationDelay: `${i * 90}ms`, animationDuration: `${450 + i * 60}ms` }} />
                ))}
                <span className="text-xs text-purple-300 ml-2">Speaking</span>
              </div>
            </div>
          )}
        </div>

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
              {interimText
                ? `"${interimText}"`
                : sttStatus === "processing"
                ? "Processing..."
                : `Listening...`}
            </p>
            <button
              onPointerDown={handleMicPointerDown}
              onPointerUp={handleMicPointerUp}
              onPointerLeave={handleMicPointerUp}
              onPointerCancel={handleMicPointerUp}
              className="text-xs text-red-300 bg-red-500/20 px-2.5 py-1 rounded-lg"
            >
              Done
            </button>
          </div>
        )}

        {/* Glassmorphism input bar */}
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-md border border-white/20 rounded-2xl px-3 py-2">

          {/* Mic button */}
          <button
            onPointerDown={handleMicPointerDown}
            onPointerUp={handleMicPointerUp}
            onPointerLeave={handleMicPointerUp}
            onPointerCancel={handleMicPointerUp}
            disabled={sttStatus === "processing" || isSending}
            className={`flex-shrink-0 p-2 rounded-xl transition-all select-none touch-none disabled:opacity-40 ${
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
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isRecording ? "" :
              inputMode === "voice" ? `Or type to ${character.name}...` :
              `Message ${character.name}...`
            }
            rows={1}
            className="flex-1 bg-transparent text-white text-sm placeholder-white/40 focus:outline-none resize-none max-h-24"
            style={{ minHeight: "28px" }}
            disabled={isSending || isRecording}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="flex-shrink-0 p-2 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 text-white transition-all disabled:opacity-30 active:scale-95"
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

        {inputMode === "voice" && !isRecording && (
          <div className="flex justify-between items-center mt-1.5 px-1">
            <span className="text-[11px] text-purple-400 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse" />
              Voice mode
            </span>
            <button onClick={() => setInputMode("text")} className="text-[11px] text-white/30 hover:text-white/60 transition">
              Switch to text
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
