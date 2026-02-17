"use client"

import { useCallback, useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle, XCircle } from "lucide-react"

import { CardWrapper } from "@/components/auth/card-wrapper"
import { FormError } from "@/components/form-error"
import { FormSuccess } from "@/components/form-success"
import { newVerification } from "@/actions/user/new-verification"

export const NewVerificationForm = () => {
  const [error, setError] = useState<string | undefined>()
  const [success, setSuccess] = useState<string | undefined>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl")
  const token = searchParams.get("token")

  const onSubmit = useCallback(() => {
    if (success || error) return

    if (!token) {
      setError("Missing token!")
      return
    }

    newVerification(token)
      .then((data) => {
        if (data.success) {
          setSuccess(data.success)
          router.replace("/auth/login" + callbackUrl ? `?callbackUrl=${callbackUrl}` : "")
        } else {
          setError(data.error)
        }
      })
      .catch(() => {
        setError("Something went wrong!")
      })
  }, [token, success, error, router, callbackUrl])

  useEffect(() => {
    onSubmit()
  }, [onSubmit])

  return (
    <CardWrapper
      headerLabel="Confirming your verification"
      backButtonLabel="Back to login"
      backButtonHref="/auth/login"
      title="Email Verification"
    >
      <div className="flex flex-col items-center justify-center space-y-4 py-8">
        {!success && !error && (
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <div className="absolute inset-0 h-8 w-8 rounded-full border-2 border-primary/20" />
            </div>
            <p className="text-sm text-muted-foreground animate-pulse">Verifying your email address...</p>
          </div>
        )}

        {success && (
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <CheckCircle className="h-8 w-8 text-green-500" />
              <div className="absolute inset-0 h-8 w-8 rounded-full bg-green-500/10" />
            </div>
            <FormSuccess message={success} />
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center space-y-3">
            <div className="relative">
              <XCircle className="h-8 w-8 text-destructive" />
              <div className="absolute inset-0 h-8 w-8 rounded-full bg-destructive/10" />
            </div>
            <FormError message={error} />
          </div>
        )}
      </div>
    </CardWrapper>
  )
}
