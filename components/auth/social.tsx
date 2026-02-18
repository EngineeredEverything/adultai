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
    <div className="w-full space-y-3">
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-muted" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground font-medium">Or continue with</span>
        </div>
      </div>
      <Button
        size="lg"
        className="w-full h-11 font-medium bg-transparent"
        variant="outline"
        onClick={() => onClick("google")}
      >
        <FcGoogle className="h-5 w-5 mr-2" />
        Continue with Google
      </Button>
    </div>
  )
}
