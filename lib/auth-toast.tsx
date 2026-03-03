"use client"

/**
 * auth-toast.tsx
 *
 * Call `showAuthToast(action)` anywhere a feature requires sign-in.
 * Instead of an error, the user sees a branded prompt with a Sign In / Sign Up link.
 *
 * Usage:
 *   import { showAuthToast } from "@/lib/auth-toast"
 *   if (!user) { showAuthToast("vote"); return; }
 */

import { toast } from "sonner"

const ACTION_LABELS: Record<string, string> = {
  vote:      "vote on images",
  comment:   "comment",
  generate:  "generate images",
  save:      "save images",
  animate:   "animate images",
  upscale:   "upscale images",
  remix:     "remix images",
  speak:     "use voice features",
  customize: "customize companions",
  chat:      "chat with companions",
  default:   "use this feature",
}

export function showAuthToast(action: keyof typeof ACTION_LABELS | string = "default") {
  const label = ACTION_LABELS[action] ?? ACTION_LABELS.default

  toast(
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center flex-shrink-0">
        <span className="text-white font-bold text-sm">A</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white leading-tight">Sign in to {label}</p>
        <p className="text-xs text-gray-400 mt-0.5">Join AdultAI — it&apos;s free</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <a
          href="/auth/login"
          className="text-xs px-3 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-pink-600 text-white font-semibold hover:opacity-90 transition-opacity"
        >
          Sign In
        </a>
        <a
          href="/auth/register"
          className="text-xs px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white font-semibold transition-colors"
        >
          Sign Up
        </a>
      </div>
    </div>,
    {
      duration: 5000,
      style: {
        background: "rgb(3 7 18 / 0.97)",
        border: "1px solid rgb(139 92 246 / 0.25)",
        borderRadius: "12px",
        padding: "12px 14px",
        maxWidth: "420px",
      },
    }
  )
}

/**
 * Returns true if the error from a server action means "not authenticated".
 * Use to check action results without duplicating the string check everywhere.
 */
export function isAuthError(error: string): boolean {
  return (
    error === "Not authenticated" ||
    error === "Unauthorized" ||
    error === "Unauthorized access"
  )
}
