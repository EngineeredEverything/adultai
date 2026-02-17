"use client"

import { Alert, AlertDescription } from "@/components/ui/alert"
import { Ban, Clock } from "lucide-react"
import type { SubscriptionStatus } from "@/app/(user)/gallery/components/GenerationForm/subscription-utils"

interface UserStatusAlertProps {
  subscriptionStatus: SubscriptionStatus
}

export function UserStatusAlert({ subscriptionStatus }: UserStatusAlertProps) {
  const status = subscriptionStatus?.status;

  if (status?.isBanned) {
    return (
      <Alert className="mb-4 border-red-200 bg-red-50">
        <Ban className="h-4 w-4 text-red-600" />
        <AlertDescription className="text-red-800">
          Your account has been banned. Please contact support for assistance.
        </AlertDescription>
      </Alert>
    );
  }

  if (status?.isSuspended) {
    const now = new Date();
    const expiresAt = status?.suspensionExpiresAt;
    const isStillSuspended = !expiresAt || expiresAt > now;

    if (isStillSuspended) {
      return (
        <Alert className="mb-4 border-yellow-200 bg-yellow-50">
          <Clock className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            Your account is temporarily suspended.
            {expiresAt &&
              ` Suspension expires on ${expiresAt.toLocaleDateString()}.`}
          </AlertDescription>
        </Alert>
      );
    }
  }

  return null
}
