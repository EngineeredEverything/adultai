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
  const [isPlaying, setIsPlaying] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)

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

  // Streaming send
  const handleSend = useCallback(async () => {
    const content = input.trim()
    if (!content || isSending) return

    setInput("")
    setIsSending(true)

    // Add user message
    const userMsg: Message = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      createdAt: new Date(),
    }

    // Add streaming placeholder for assistant
    const streamId = `s-${Date.now()}`
    const streamingMsg: Message = {
      id: streamId,
      role: "assistant",
      content: "",
      createdAt: new Date(),
      streaming: true,
    }

    setMessages((prev) => [...prev, userMsg, streamingMsg])

    abortRef.current = new AbortController()

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterId: character.id,
          content,
          withVoice: voiceEnabled,
        }),
        signal: abortRef.current.signal,
      })

      if (!res.ok || !res.body) {
        throw new Error("Stream failed")
      }

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
                prev.map((m) =>
                  m.id === streamId ? { ...m, content: m.content + event.token } : m
                )
              )
            }

            if (event.textDone) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamId
                    ? { ...m, streaming: false, id: event.messageId || m.id }
                    : m
                )
              )
            }

            if (event.audioUrl) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === streamId || m.id === event.messageId
                    ? { ...m, audioUrl: event.audioUrl }
                    : m
                )
              )
              if (voiceEnabled) {
                playAudio(event.audioUrl)
              }
            }

            if (event.done || event.error) {
              setIsSending(false)
            }
          } catch {}
        }
      }
    } catch (err: any) {
      if (err.name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === streamId
              ? { ...m, content: "I couldn't respond right now. Try again? 💭", streaming: false }
              : m
          )
        )
      }
      setIsSending(false)
    }
  }, [input, isSending, character.id, voiceEnabled, playAudio])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  // STT: Browser Web Speech API (primary)
  const startBrowserSTT = useCallback((): boolean => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition) return false

    try {
      const recognition = new SpeechRecognition()
      recognitionRef.current = recognition
      recognition.continuous = false
      recognition.interimResults = false
      recognition.lang = "en-US"

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
        setSttStatus("idle")
        setIsRecording(false)
      }

      recognition.onerror = () => {
        startMediaRecorderSTT()
      }

      recognition.onend = () => {
        if (recognitionRef.current === recognition) recognitionRef.current = null
      }

      recognition.start()
      setSttStatus("listening")
      setIsRecording(true)
      return true
    } catch {
      return false
    }
  }, [])

  // STT: MediaRecorder → server fallback
  const startMediaRecorderSTT = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg"
      const recorder = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = recorder
      audioChunksRef.current = []

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

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
            setInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript))
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
  }, [])

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop()
      recognitionRef.current = null
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop()
      }
      setSttStatus("idle")
      setIsRecording(false)
      return
    }
    if (!startBrowserSTT()) startMediaRecorderSTT()
  }, [isRecording, startBrowserSTT, startMediaRecorderSTT])

  return (
    <div className="flex flex-col h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800/60 bg-gray-950/90 backdrop-blur-sm">
        <Link href="/companions" className="text-gray-500 hover:text-white transition p-1">
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>

        <div className="relative w-10 h-10 flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-gray-800 overflow-hidden ring-2 ring-purple-500/30">
            {character.portraitUrl ? (
              <img src={character.portraitUrl} alt={character.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-lg">💜</div>
            )}
          </div>
          {/* Online indicator */}
          <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-gray-950" />
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{character.name}</h2>
          <p className="text-xs text-green-400/80">
            {isPlaying ? "🔊 Speaking..." : isSending ? "✍️ Typing..." : "Online"}
          </p>
        </div>

        {/* Voice toggle */}
        <button
          onClick={() => setVoiceEnabled(!voiceEnabled)}
          className={`p-2 rounded-lg transition-all ${
            voiceEnabled
              ? "bg-purple-500/20 text-purple-400 border border-purple-500/30"
              : "text-gray-600 hover:text-gray-300"
          }`}
          title={voiceEnabled ? "Voice ON — tap to disable" : "Enable voice"}
        >
          {voiceEnabled ? (
            // Speaker with waves
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
            </svg>
          ) : (
            // Speaker muted
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
            </svg>
          )}
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full pb-8 text-center">
            {character.portraitUrl && (
              <div className="w-28 h-28 rounded-full overflow-hidden ring-4 ring-purple-500/20 mb-4">
                <img src={character.portraitUrl} alt={character.name} className="w-full h-full object-cover" />
              </div>
            )}
            <h3 className="text-2xl font-bold mb-1">{character.name}</h3>
            <p className="text-purple-400 text-sm mb-4">{character.personality}</p>
            <p className="text-gray-600 text-xs">Say hello to start your conversation 👋</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {/* Companion avatar */}
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-gray-800 overflow-hidden flex-shrink-0 mt-1">
                {character.portraitUrl ? (
                  <img src={character.portraitUrl} alt={character.name} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm">💜</div>
                )}
              </div>
            )}

            <div className={`max-w-[78%] ${msg.role === "user" ? "items-end" : "items-start"} flex flex-col gap-1`}>
              <div
                className={`rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-purple-600 text-white rounded-br-md"
                    : "bg-gray-800/80 text-gray-100 rounded-bl-md border border-gray-700/40"
                }`}
              >
                <p className="whitespace-pre-wrap break-words leading-relaxed text-sm">
                  {msg.content}
                  {/* Blinking cursor while streaming */}
                  {msg.streaming && (
                    <span className="inline-block w-0.5 h-4 bg-purple-400 ml-0.5 animate-pulse align-middle" />
                  )}
                </p>

                {/* Audio player */}
                {msg.audioUrl && !isPlaying && (
                  <button
                    onClick={() => playAudio(msg.audioUrl!)}
                    className="mt-2 flex items-center gap-2 text-xs text-purple-300 hover:text-purple-200 transition"
                  >
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Play voice
                  </button>
                )}

                {/* Waveform animation while playing */}
                {msg.audioUrl && isPlaying && activeAudioRef.current && (
                  <div className="mt-2 flex items-center gap-0.5 h-5">
                    {[...Array(8)].map((_, i) => (
                      <div
                        key={i}
                        className="w-0.5 bg-purple-400 rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 14 + 4}px`,
                          animationDelay: `${i * 80}ms`,
                          animationDuration: `${400 + i * 60}ms`,
                        }}
                      />
                    ))}
                    <span className="text-xs text-purple-300 ml-2">Speaking</span>
                  </div>
                )}
              </div>

              <div className={`text-xs text-gray-600 px-1 ${msg.role === "user" ? "text-right" : "text-left"}`}>
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800/60 px-4 py-3 bg-gray-950/90 backdrop-blur-sm">
        {/* Status row */}
        <div className="flex gap-2 mb-2 min-h-[20px]">
          {voiceEnabled && !isRecording && (
            <span className="text-xs text-purple-400/70 flex items-center gap-1">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12" />
              </svg>
              Voice on
            </span>
          )}
          {isRecording && (
            <span className="text-xs text-red-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {sttStatus === "processing" ? "Processing..." : "Listening — tap mic to stop"}
            </span>
          )}
          {isPlaying && (
            <span className="text-xs text-purple-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
              {character.name} is speaking...
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
          {/* Mic button */}
          <button
            onClick={handleMicClick}
            disabled={sttStatus === "processing" || isSending}
            className={`p-3 rounded-xl transition-all flex-shrink-0 ${
              isRecording
                ? "bg-red-500 text-white shadow-lg shadow-red-500/20"
                : "bg-gray-900 border border-gray-700 text-gray-500 hover:text-purple-400 hover:border-purple-500/40"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isRecording ? "Stop recording" : "Speak your message"}
          >
            {isRecording ? (
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            )}
          </button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening..." : `Message ${character.name}...`}
            rows={1}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-purple-500/60 focus:ring-1 focus:ring-purple-500/30 transition-all resize-none max-h-32"
            style={{ minHeight: "48px" }}
            disabled={isSending || isRecording}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isSending}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 p-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-lg shadow-purple-500/20"
          >
            {isSending ? (
              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
