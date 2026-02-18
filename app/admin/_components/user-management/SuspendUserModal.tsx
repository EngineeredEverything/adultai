"use client";

import type React from "react";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUserActions } from "./hooks/useUserActions";
import { toast } from "sonner";

export function SuspendUserModal({
  user,
  children,
  onConfirm,
}: {
  user: any;
  children?: React.ReactNode;
  onConfirm?: (reason: string, duration?: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [duration, setDuration] = useState("");
  const { handleSuspendUser, isLoading } = useUserActions();

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error("Error", {
        description: "Please provide a reason for suspension",
      });
      return;
    }

    const result = await handleSuspendUser(
      user.id,
      reason,
      duration || undefined,
      () => {
        onConfirm?.(reason, duration);
        setOpen(false);
        setReason("");
        setDuration("");
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Suspend {user.name}?</DialogTitle>
          <DialogDescription>
            Suspended users will be temporarily restricted from accessing the
            platform.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason for suspension *</Label>
            <Textarea
              id="reason"
              placeholder="Reason for suspension..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="duration">Duration (optional)</Label>
            <Input
              id="duration"
              placeholder="e.g. 7d, 30d, 1m, 1y (leave blank for indefinite)"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Format: number + unit (d=days, w=weeks, m=months, y=years)
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading("suspend", user.id)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading("suspend", user.id)}
          >
            {isLoading("suspend", user.id)
              ? "Suspending..."
              : "Confirm Suspension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
