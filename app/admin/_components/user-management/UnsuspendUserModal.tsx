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
import { unsuspendUser } from "@/actions/user/update";
import { toast } from "sonner";

export function UnsuspendUserModal({
  user,
  children,
  onConfirm,
}: {
  user: any;
  children?: React.ReactNode;
  onConfirm?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    setIsLoading(true);
    try {
      const result = await unsuspendUser(user.id);

      if (result.success) {
        toast.success("Success",{
          description: `User ${user.name} has been unsuspended`,
        });
        onConfirm?.();
        setOpen(false);
      } else {
        toast.error("Error",{
          description: result.error || "Failed to unsuspend user",
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Unsuspend {user.name}?</DialogTitle>
          <DialogDescription>
            This will restore the user&apos;s access to the platform.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? "Unsuspending..." : "Confirm Unsuspension"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
