"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { createCharacter } from "@/actions/characters/create"

const GENDERS = [
  { id: "woman", label: "Woman", emoji: "👩", desc: "Female companion" },
  { id: "man", label: "Man", emoji: "👨", desc: "Male companion" },
]

const PERSONALITIES = [
  { id: "playful", label: "Playful", emoji: "😏", desc: "Flirty, fun, and spontaneous" },
  { id: "romantic", label: "Romantic", emoji: "💕", desc: "Passionate, poetic, and intimate" },
  { id: "mysterious", label: "Mysterious", emoji: "🌙", desc: "Enigmatic, alluring, and deep" },
  { id: "confident", label: "Confident", emoji: "🔥", desc: "Bold, direct, and commanding" },
  { id: "submissive", label: "Submissive", emoji: "🌸", desc: "Sweet, eager, and attentive" },
  { id: "dominant", label: "Dominant", emoji: "👑", desc: "Authoritative, decisive, and powerful" },
]

const APPEARANCES = [
  { id: "realistic", label: "Realistic", emoji: "📷", desc: "Photorealistic style" },
  { id: "artistic", label: "Artistic", emoji: "🎨", desc: "Stylized digital art" },
  { id: "anime", label: "Anime", emoji: "✨", desc: "Anime / manga style" },
]

const TOTAL_STEPS = 5

export default function CreateCompanionForm() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [gender, setGender] = useState("")
  const [name, setName] = useState("")
  const [personality, setPersonality] = useState("")
  const [appearance, setAppearance] = useState("")
  const [description, setDescription] = useState("")
  const [error, setError] = useState("")
  const [step, setStep] = useState(1)

  const canProceed = () => {
    if (step === 1) return gender !== ""
    if (step === 2) return name.trim().length > 0
    if (step === 3) return personality !== ""
    if (step === 4) return appearance !== ""
    return true
  }

  const handleCreate = () => {
    setError("")
    startTransition(async () => {
      const result = await createCharacter({
        name: name.trim(),
        gender: gender as any,
        personality: personality as any,
        appearance: appearance as any,
        description: description.trim() || undefined,
      })

      if ("error" in result && result.error) {
        setError(result.error)
        return
      }

      if ("character" in result && result.character) {
        router.push(`/companions/${result.character.id}/chat`)
      }
    })
  }

  return (
    <div className="space-y-8">
      {/* Progress bar */}
      <div className="flex gap-2">
        {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors duration-300 ${
              i + 1 <= step ? "bg-gradient-to-r from-purple-500 to-pink-500" : "bg-gray-800"
            }`}
          />
        ))}
      </div>

      {/* Step 1: Gender */}
      {step === 1 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <label className="block text-sm font-medium text-gray-300">
            Who are you looking for?
          </label>
          <div className="grid grid-cols-2 gap-4">
            {GENDERS.map((g) => (
              <button
                key={g.id}
                onClick={() => setGender(g.id)}
                className={`p-6 rounded-xl border text-center transition-all duration-200 ${
                  gender === g.id
                    ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <div className="text-5xl mb-3">{g.emoji}</div>
                <div className="font-semibold text-lg">{g.label}</div>
                <div className="text-xs text-gray-400 mt-1">{g.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 2: Name */}
      {step === 2 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              What&apos;s your companion&apos;s name?
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter a name..."
              maxLength={50}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter" && canProceed()) setStep(step + 1) }}
            />
          </div>
        </div>
      )}

      {/* Step 3: Personality */}
      {step === 3 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <label className="block text-sm font-medium text-gray-300">
            Choose a personality
          </label>
          <div className="grid grid-cols-2 gap-3">
            {PERSONALITIES.map((p) => (
              <button
                key={p.id}
                onClick={() => setPersonality(p.id)}
                className={`p-4 rounded-xl border text-left transition-all duration-200 ${
                  personality === p.id
                    ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <div className="text-2xl mb-1">{p.emoji}</div>
                <div className="font-medium">{p.label}</div>
                <div className="text-xs text-gray-400 mt-1">{p.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 4: Appearance */}
      {step === 4 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <label className="block text-sm font-medium text-gray-300">
            Choose an appearance style
          </label>
          <div className="grid grid-cols-3 gap-3">
            {APPEARANCES.map((a) => (
              <button
                key={a.id}
                onClick={() => setAppearance(a.id)}
                className={`p-6 rounded-xl border text-center transition-all duration-200 ${
                  appearance === a.id
                    ? "border-purple-500 bg-purple-500/10 shadow-lg shadow-purple-500/20"
                    : "border-gray-800 bg-gray-900 hover:border-gray-700"
                }`}
              >
                <div className="text-4xl mb-2">{a.emoji}</div>
                <div className="font-medium">{a.label}</div>
                <div className="text-xs text-gray-400 mt-1">{a.desc}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Step 5: Description (optional) + Confirm */}
      {step === 5 && (
        <div className="space-y-6 animate-in fade-in duration-300">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Any special details? <span className="text-gray-500">(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe their backstory, quirks, or specific traits..."
              maxLength={500}
              rows={3}
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all resize-none"
            />
            <div className="text-xs text-gray-500 mt-1">{description.length}/500</div>
          </div>

          {/* Summary */}
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <h3 className="font-semibold mb-3">Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Gender</span>
                <span className="capitalize">{gender}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Name</span>
                <span>{name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Personality</span>
                <span className="capitalize">{personality}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">Style</span>
                <span className="capitalize">{appearance}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex gap-3">
        {step > 1 && (
          <button
            onClick={() => setStep(step - 1)}
            className="flex-1 py-3 rounded-xl border border-gray-700 text-gray-300 hover:bg-gray-900 transition-all"
          >
            Back
          </button>
        )}
        {step < TOTAL_STEPS ? (
          <button
            onClick={() => setStep(step + 1)}
            disabled={!canProceed()}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        ) : (
          <button
            onClick={handleCreate}
            disabled={isPending}
            className="flex-1 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 font-medium transition-all disabled:opacity-60"
          >
            {isPending ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Creating...
              </span>
            ) : (
              "Create Companion ✨"
            )}
          </button>
        )}
      </div>
    </div>
  )
}
