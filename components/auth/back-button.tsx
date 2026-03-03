"use client"

import type React from "react"
import { useRouter } from "next/navigation"
import type { Dispatch, SetStateAction } from "react"
import Link from "next/link"

interface BackButtonProps {
  href: string
  label: string
  onClose?: Dispatch<SetStateAction<boolean>>
}

export const BackButton = ({ href, label, onClose }: BackButtonProps) => {
  const router = useRouter()

  const inner = (
    <p className="text-center text-sm text-gray-500">
      {label.split("Sign up")[0]}
      {label.includes("Sign up") && (
        <span className="text-purple-400 hover:text-purple-300 font-medium transition-colors cursor-pointer">
          Sign up
        </span>
      )}
      {!label.includes("Sign up") && !label.includes("Sign in") && label}
      {label.includes("Sign in") && (
        <span className="text-purple-400 hover:text-purple-300 font-medium transition-colors cursor-pointer">
          Sign in
        </span>
      )}
    </p>
  )

  if (onClose) {
    const handleProcessing = (e: React.MouseEvent) => {
      e.preventDefault()
      onClose(false)
      router.replace(href)
    }
    return (
      <button onClick={handleProcessing} className="w-full" type="button">
        {inner}
      </button>
    )
  }

  return (
    <Link href={href} className="w-full block">
      {inner}
    </Link>
  )
}
