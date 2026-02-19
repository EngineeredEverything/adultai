"use client"

import { useEffect, useState } from "react"
import Link from "next/link"

interface FreeCreditsIndicatorProps {
  remainingCredits: number | null
  freeLimit: number
  className?: string
}

export default function FreeCreditsIndicator({
  remainingCredits,
  freeLimit,
  className = "",
}: FreeCreditsIndicatorProps) {
  const [isVisible, setIsVisible] = useState(true)

  // Don't show if user has unlimited (paid subscription)
  if (remainingCredits === null || remainingCredits === -1) {
    return null
  }

  const percentage = (remainingCredits / freeLimit) * 100
  const isLow = percentage <= 30
  const isEmpty = remainingCredits === 0

  if (!isVisible && !isEmpty) return null

  return (
    <div
      className={`bg-gradient-to-r ${
        isEmpty
          ? "from-red-500/20 to-orange-500/20 border-red-500/30"
          : isLow
          ? "from-orange-500/20 to-yellow-500/20 border-orange-500/30"
          : "from-purple-500/20 to-pink-500/20 border-purple-500/30"
      } border rounded-xl p-4 ${className}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="text-lg font-semibold">
              {isEmpty ? (
                <span className="text-red-400">Free Generations Used</span>
              ) : (
                <span>
                  {remainingCredits} of {freeLimit} Free Generations
                </span>
              )}
            </div>
            {!isEmpty && !isLow && (
              <button
                onClick={() => setIsVisible(false)}
                className="text-gray-400 hover:text-white transition"
                aria-label="Dismiss"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Progress bar */}
          {!isEmpty && (
            <div className="w-full bg-gray-800 rounded-full h-2 mb-2">
              <div
                className={`h-2 rounded-full transition-all duration-300 ${
                  isLow
                    ? "bg-gradient-to-r from-orange-500 to-yellow-500"
                    : "bg-gradient-to-r from-purple-500 to-pink-500"
                }`}
                style={{ width: `${percentage}%` }}
              />
            </div>
          )}

          <p className="text-sm text-gray-400">
            {isEmpty ? (
              "Upgrade to continue generating images"
            ) : isLow ? (
              <>
                You're running low on free generations.{" "}
                <Link href="/subscription" className="text-purple-400 hover:text-purple-300 underline">
                  Upgrade now
                </Link>{" "}
                for unlimited access.
              </>
            ) : (
              <>
                Try AdultAI free!{" "}
                <Link href="/subscription" className="text-purple-400 hover:text-purple-300 underline">
                  Upgrade
                </Link>{" "}
                for unlimited generations.
              </>
            )}
          </p>
        </div>

        {isEmpty ? (
          <Link
            href="/subscription"
            className="flex-shrink-0 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold transition-all shadow-lg shadow-purple-500/30"
          >
            Upgrade Now
          </Link>
        ) : (
          isLow && (
            <Link
              href="/subscription"
              className="flex-shrink-0 px-4 py-2 border border-purple-500 hover:bg-purple-500/10 rounded-xl font-medium transition-all"
            >
              Upgrade
            </Link>
          )
        )}
      </div>
    </div>
  )
}
