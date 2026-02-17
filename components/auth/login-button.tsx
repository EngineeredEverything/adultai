"use client"

import type React from "react"

import { useRouter, useSearchParams } from "next/navigation"

import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog"
import { LoginForm } from "@/components/auth/login-form"

interface LoginButtonProps {
  children: React.ReactNode
  mode?: "modal" | "redirect"
  asChild?: boolean
  isOpen?: boolean
  onClose?: () => void
}

export const LoginButton = ({ children, mode = "redirect", asChild, isOpen, onClose }: LoginButtonProps) => {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl")

  const onClick = () => {
    const url = "/auth/login" + (callbackUrl && callbackUrl !== "null" ? `?callbackUrl=${callbackUrl}` : "")
    router.push(url)
  }

  const handleOpenChange = (open: boolean) => {
    if (!open && onClose) {
      onClose()
    }
  }

  if (mode === "modal") {
    return (
      <Dialog open={isOpen} onOpenChange={handleOpenChange}>
        <DialogTrigger className="w-full" asChild={asChild}>
          {children}
        </DialogTrigger>
        <DialogContent className="p-0 w-auto bg-transparent border-none">
          <LoginForm onClose={onClose} />
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <span onClick={onClick} className="cursor-pointer">
      {children}
    </span>
  )
}
