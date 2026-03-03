"use client"

import { signIn } from "next-auth/react"
import { FcGoogle } from "react-icons/fc"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { APP_URL, DEFAULT_LOGIN_REDIRECT } from "@/routes"
import { logger } from "@/lib/logger"

export const Social = () => {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl")

  const onClick = (provider: "google") => {
    logger.info(APP_URL)
    signIn(provider, {
      callbackUrl: callbackUrl || DEFAULT_LOGIN_REDIRECT,
    })
  }

  return (
    <div className="w-full space-y-4">
      {/* Divider */}
      <div className="relative flex items-center gap-3">
        <div className="flex-1 h-px bg-white/8" />
        <span className="text-[11px] uppercase tracking-widest text-gray-500 font-medium whitespace-nowrap">
          or continue with
        </span>
        <div className="flex-1 h-px bg-white/8" />
      </div>

      {/* Google button */}
      <button
        type="button"
        onClick={() => onClick("google")}
        className="w-full flex items-center justify-center gap-3 h-11 rounded-xl
          bg-white/5 hover:bg-white/10 active:bg-white/8
          border border-white/10 hover:border-white/20
          transition-all duration-200 group"
      >
        <FcGoogle className="w-5 h-5 flex-shrink-0" />
        <span className="text-sm font-medium text-gray-300 group-hover:text-white transition-colors">
          Continue with Google
        </span>
      </button>
    </div>
  )
}
