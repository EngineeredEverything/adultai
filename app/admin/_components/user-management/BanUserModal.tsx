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
import { Label } from "@/components/ui/label";
import { useUserActions } from "./hooks/useUserActions";
import { toast } from "sonner";

export function BanUserModal({
  user,
  children,
  onConfirm,
}: {
  user: any;
  children?: React.ReactNode;
  onConfirm?: (reason: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const { handleBanUser, isLoading } = useUserActions();

  const handleConfirm = async () => {
    if (!reason.trim()) {
      toast.error("Error", {
        description: "Please provide a reason for banning",
      });
      return;
    }

    const result = await handleBanUser(user.id, reason, () => {
      onConfirm?.(reason);
      setOpen(false);
      setReason("");
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ban {user.name}?</DialogTitle>
          <DialogDescription>
            Banning this user will permanently block access to their account.
            This action also suspends the user.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="ban-reason">Reason for ban *</Label>
          <Textarea
            id="ban-reason"
            placeholder="Reason for ban..."
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading("ban", user.id)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isLoading("ban", user.id)}
          >
            {isLoading("ban", user.id) ? "Banning..." : "Confirm Ban"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
