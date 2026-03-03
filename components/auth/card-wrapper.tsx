"use client"

import type React from "react"
import { Header } from "@/components/auth/header"
import { Social } from "@/components/auth/social"
import { BackButton } from "@/components/auth/back-button"
import { useSearchParams } from "next/navigation"
import type { Dispatch, SetStateAction } from "react"

interface CardWrapperProps {
  children: React.ReactNode
  headerLabel: string
  backButtonLabel: string
  backButtonHref: string
  showSocial?: boolean
  title: string
  onClose?: Dispatch<SetStateAction<boolean>>
}

export const CardWrapper = ({
  children,
  headerLabel,
  backButtonLabel,
  backButtonHref,
  showSocial,
  title,
  onClose,
}: CardWrapperProps) => {
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl")

  return (
    <div className="w-full max-w-md mx-auto">
      {/* Glow backdrop */}
      <div className="relative rounded-2xl overflow-hidden">
        <div className="absolute -inset-px bg-gradient-to-b from-purple-500/30 via-pink-500/10 to-transparent rounded-2xl" />
        <div className="relative bg-gray-950/95 backdrop-blur-xl rounded-2xl border border-white/8 shadow-2xl shadow-black/60">

          {/* Top gradient bar */}
          <div className="h-px w-full bg-gradient-to-r from-transparent via-purple-500/60 to-transparent" />

          {/* Header */}
          <div className="pt-8 pb-2 px-8">
            <Header title={title} label={headerLabel} />
          </div>

          {/* Content */}
          <div className="px-8 pb-6 space-y-5">
            {children}
          </div>

          {/* Social */}
          {showSocial && (
            <div className="px-8 pb-4">
              <Social />
            </div>
          )}

          {/* Back button */}
          <div className="px-8 pb-7 pt-1">
            <BackButton
              onClose={onClose}
              label={backButtonLabel}
              href={backButtonHref + (callbackUrl ? `?callbackUrl=${callbackUrl}` : "")}
            />
          </div>

          {/* Bottom gradient bar */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-pink-500/40 to-transparent" />
        </div>
      </div>
    </div>
  )
}
