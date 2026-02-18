"use client";

import type React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useUserActions } from "./hooks/useUserActions";
import { toast } from "sonner";

export function SendMessageModal({
  user,
  children,
}: {
  user: any;
  children?: React.ReactNode;
}) {
  const [message, setMessage] = useState("");
  const [open, setOpen] = useState(false);
  const { handleSendMessage, isLoading } = useUserActions();

  const handleSend = async () => {
    if (!message.trim()) {
      toast.error("Error", {
        description: "Please enter a message",
      });
      return;
    }

    const result = await handleSendMessage(user.id, message.trim(), () => {
      setMessage("");
      setOpen(false);
    });
  };

  const onClose = () => {
    setOpen(false);
    setMessage("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Send Message to {user.name}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="message">Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write your message here..."
              rows={4}
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-4">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isLoading("message", user.id)}
          >
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={isLoading("message", user.id)}>
            {isLoading("message", user.id) ? "Sending..." : "Send Message"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
