"use client"

import { useState, useRef, useEffect, useTransition, useCallback } from "react"
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
  const [isRecording, setIsRecording] = useState(false)
  const [sttStatus, setSttStatus] = useState<"idle" | "listening" | "processing">("idle")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const recognitionRef = useRef<any>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const activeAudioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // Auto-play audio responses when voice is enabled
  useEffect(() => {
    if (!voiceEnabled) return
    const lastMsg = messages[messages.length - 1]
    if (lastMsg?.role === "assistant" && lastMsg.audioUrl) {
      if (activeAudioRef.current) {
        activeAudioRef.current.pause()
        activeAudioRef.current = null
      }
      const audio = new Audio(lastMsg.audioUrl)
      activeAudioRef.current = audio
      audio.play().catch(() => {}) // Ignore autoplay restrictions
    }
  }, [messages, voiceEnabled])

  // STT: Browser Web Speech API (primary - free)
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
      recognition.maxAlternatives = 1

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript
        setInput((prev) => (prev ? `${prev} ${transcript}` : transcript))
        setSttStatus("idle")
        setIsRecording(false)
      }

      recognition.onerror = (event: any) => {
        console.warn("Browser STT error:", event.error)
        // Fall back to server-side STT
        startMediaRecorderSTT()
      }

      recognition.onend = () => {
        if (recognitionRef.current === recognition) {
          recognitionRef.current = null
        }
      }

      recognition.start()
      setSttStatus("listening")
      setIsRecording(true)
      return true
    } catch {
      return false
    }
  }, [])

  // STT: MediaRecorder → ElevenLabs → Whisper fallback
  const startMediaRecorderSTT = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/ogg",
      })
      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = async () => {
        setSttStatus("processing")
        stream.getTracks().forEach((t) => t.stop())

        const audioBlob = new Blob(audioChunksRef.current, { type: mediaRecorder.mimeType })

        try {
          const formData = new FormData()
          formData.append("audio", audioBlob, "recording.webm")

          const res = await fetch("/api/stt", { method: "POST", body: formData })
          const data = await res.json()

          if (data.transcript) {
            setInput((prev) => (prev ? `${prev} ${data.transcript}` : data.transcript))
          }
        } catch (err) {
          console.error("STT fallback failed:", err)
        } finally {
          setSttStatus("idle")
          setIsRecording(false)
          mediaRecorderRef.current = null
        }
      }

      mediaRecorder.start()
      setSttStatus("listening")
      setIsRecording(true)
    } catch {
      setSttStatus("idle")
      setIsRecording(false)
    }
  }, [])

  const handleMicClick = useCallback(() => {
    if (isRecording) {
      // Stop recording
      if (recognitionRef.current) {
        recognitionRef.current.stop()
        recognitionRef.current = null
        setSttStatus("idle")
        setIsRecording(false)
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop()
      }
      return
    }

    // Try browser STT first, fall back to MediaRecorder
    const browserStarted = startBrowserSTT()
    if (!browserStarted) {
      startMediaRecorderSTT()
    }
  }, [isRecording, startBrowserSTT, startMediaRecorderSTT])

  const handleSend = () => {
    const content = input.trim()
    if (!content || isPending) return

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
            <div className="w-full h-full flex items-center justify-center text-xl">
              💜
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate">{character.name}</h2>
          <p className="text-xs text-green-400">● Online</p>
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
            title={voiceEnabled ? "Voice responses ON" : "Enable voice responses"}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072M12 6a7 7 0 010 12M8.464 8.464a5 5 0 000 7.072" />
            </svg>
          </button>
          <button
            onClick={() => setVideoEnabled(!videoEnabled)}
            className={`p-2 rounded-lg transition-all ${
              videoEnabled
                ? "bg-pink-500/20 text-pink-400 border border-pink-500/30"
                : "text-gray-500 hover:text-gray-300"
            }`}
            title={videoEnabled ? "Video responses ON" : "Enable video responses"}
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
          <div className="text-center py-16">
            <div className="text-6xl mb-4">
              {character.portraitUrl ? (
                <img src={character.portraitUrl} alt={character.name} className="w-24 h-24 rounded-full object-cover mx-auto border-2 border-purple-500/30" />
              ) : "💜"}
            </div>
            <h3 className="text-xl font-semibold mb-2">{character.name}</h3>
            <p className="text-gray-400 text-sm mb-1">{character.personality}</p>
            <p className="text-gray-600 text-xs">Say hello to start chatting 👋</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-purple-600 text-white rounded-br-md"
                  : "bg-gray-800 text-gray-100 rounded-bl-md"
              }`}
            >
              <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>

              {/* Audio player */}
              {msg.audioUrl && (
                <div className="mt-2">
                  <audio controls className="w-full h-8" preload="auto">
                    <source src={msg.audioUrl} type="audio/mpeg" />
                  </audio>
                </div>
              )}

              {/* Video player */}
              {msg.videoUrl && (
                <div className="mt-2 rounded-lg overflow-hidden">
                  <video
                    controls
                    autoPlay
                    className="w-full max-w-sm rounded-lg"
                    poster={character.portraitUrl || undefined}
                  >
                    <source src={msg.videoUrl} type="video/mp4" />
                  </video>
                </div>
              )}

              <div className="text-xs mt-1 opacity-40">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
          </div>
        ))}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-2xl rounded-bl-md px-5 py-4">
              <div className="flex gap-1 items-center">
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-800 px-4 py-3 bg-gray-950/90 backdrop-blur-sm">
        {/* Status badges */}
        <div className="flex gap-2 mb-2 flex-wrap">
          {voiceEnabled && (
            <span className="text-xs bg-purple-500/10 text-purple-400 px-2 py-1 rounded-full border border-purple-500/20">
              🔊 Voice on
            </span>
          )}
          {videoEnabled && (
            <span className="text-xs bg-pink-500/10 text-pink-400 px-2 py-1 rounded-full border border-pink-500/20">
              🎥 Video on
            </span>
          )}
          {isRecording && (
            <span className="text-xs bg-red-500/10 text-red-400 px-2 py-1 rounded-full border border-red-500/20 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {sttStatus === "processing" ? "Processing..." : "Listening... tap mic to stop"}
            </span>
          )}
        </div>

        <div className="flex items-end gap-2">
          {/* Mic button */}
          <button
            onClick={handleMicClick}
            disabled={sttStatus === "processing" || isPending}
            className={`p-3 rounded-xl transition-all flex-shrink-0 ${
              isRecording
                ? "bg-red-500 text-white shadow-lg shadow-red-500/30"
                : "bg-gray-900 text-gray-400 hover:text-purple-400 hover:bg-gray-800 border border-gray-700"
            } disabled:opacity-40 disabled:cursor-not-allowed`}
            title={isRecording ? "Stop recording" : "Speak your message"}
          >
            {isRecording ? (
              // Stop icon
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            ) : (
              // Mic icon
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
            placeholder={
              isRecording
                ? "Listening..."
                : `Message ${character.name}...`
            }
            rows={1}
            className="flex-1 bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none max-h-32"
            style={{ minHeight: "48px" }}
            disabled={isPending || isRecording}
          />

          <button
            onClick={handleSend}
            disabled={!input.trim() || isPending}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 p-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed flex-shrink-0 shadow-lg shadow-purple-500/20"
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
