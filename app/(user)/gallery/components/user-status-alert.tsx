"use client";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertTriangle, Ban } from "lucide-react";
import type { SubscriptionStatus } from "@/app/(user)/gallery/components/GenerationForm/subscription-utils";

interface UserStatusAlertProps {
  subscriptionStatus: SubscriptionStatus;
}

export function UserStatusAlert({ subscriptionStatus }: UserStatusAlertProps) {
  const status = subscriptionStatus?.status;

  if (status?.isBanned) {
    return (
      <Alert variant="destructive" className="mb-4">
        <Ban className="h-4 w-4" />
        <AlertTitle>Account Banned</AlertTitle>
        <AlertDescription>
          Your account has been banned and you cannot generate images or access
          premium features. Please contact support if you believe this is an
          error.
        </AlertDescription>
      </Alert>
    );
  }

  if (status?.isSuspended) {
    const now = new Date();
    const expiresAt = status.suspensionExpiresAt;
    const isTemporary = expiresAt && expiresAt > now;

    return (
      <Alert variant="destructive" className="mb-4">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Account Suspended</AlertTitle>
        <AlertDescription>
          Your account is currently suspended and you cannot generate images.
          {isTemporary && (
            <>
              <br />
              Suspension expires: {expiresAt.toLocaleDateString()} at{" "}
              {expiresAt.toLocaleTimeString()}
            </>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return null;
}
