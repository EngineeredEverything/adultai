"use client"

import type React from "react"

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"
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
    <Card className="w-full max-w-md mx-auto shadow-lg border-0 bg-white/95 backdrop-blur-sm">
      <CardHeader className="space-y-6 pb-8">
        <Header title={title} label={headerLabel} />
      </CardHeader>
      <CardContent className="space-y-6">{children}</CardContent>
      {showSocial && (
        <CardFooter className="pt-6">
          <Social />
        </CardFooter>
      )}
      <CardFooter className="pt-2">
        <BackButton
          onClose={onClose}
          label={backButtonLabel}
          href={backButtonHref + (callbackUrl ? `?callbackUrl=${callbackUrl}` : "")}
        />
      </CardFooter>
    </Card>
  )
}
