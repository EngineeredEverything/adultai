"use client"

import { useState } from "react"

export function WaitlistForm({ plan }: { plan?: string }) {
  const [email, setEmail] = useState("")
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle")
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus("loading")
    setError("")

    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), plan }),
      })
      if (res.ok) {
        setStatus("success")
      } else {
        const data = await res.json()
        setError(data.error || "Something went wrong")
        setStatus("error")
      }
    } catch {
      setError("Network error — please try again")
      setStatus("error")
    }
  }

  if (status === "success") {
    return (
      <div className="flex items-center gap-3 bg-green-500/10 border border-green-500/30 rounded-xl px-5 py-4 text-green-400">
        <span className="text-xl">✓</span>
        <div>
          <p className="font-semibold">You&apos;re on the list!</p>
          <p className="text-sm text-green-400/70">We&apos;ll email you when payments go live — with an early bird discount.</p>
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="your@email.com"
        required
        className="flex-1 px-4 py-3 rounded-xl bg-gray-800 border border-gray-700 text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 transition-colors text-sm"
      />
      <button
        type="submit"
        disabled={status === "loading"}
        className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold text-sm transition-all duration-200 shadow-lg shadow-purple-500/20 disabled:opacity-60 whitespace-nowrap"
      >
        {status === "loading" ? "Joining…" : "Join Waitlist →"}
      </button>
      {status === "error" && (
        <p className="text-red-400 text-xs mt-1">{error}</p>
      )}
    </form>
  )
}
