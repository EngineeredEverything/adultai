"use client";

import type React from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DialogTrigger } from "@radix-ui/react-dialog";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function FlagContentModal({
  image,
  onConfirm,
  children,
}: {
  image: {
    id: string;
    user: {
      name: string | null;
    };
    cdnUrl: string | undefined;
  };
  onConfirm?: (
    imageId: string,
    newStatus: "flagged" | "rejected",
    reason?: string
  ) => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<"flagged" | "rejected">("flagged");
  const [reason, setReason] = useState("");

  const handleFlag = () => {
    onConfirm?.(image.id, status, reason);
    setOpen(false);
    setStatus("flagged");
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Flag Content</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-gray-600">
            Please select the appropriate status and provide a reason.
          </p>

          {/* Image Preview */}
          {image.cdnUrl && (
            <div className="flex justify-center">
              <img
                src={image.cdnUrl || "/placeholder.svg"}
                alt="Image to flag"
                className="max-w-full max-h-32 object-contain rounded border"
              />
            </div>
          )}

          <div className="p-3 bg-gray-50 rounded-md">
            <p className="text-sm">
              <span className="font-medium">Uploaded by:</span>{" "}
              {image.user.name || "Unknown User"}
            </p>
            <p className="text-sm">
              <span className="font-medium">ID:</span> {image.id}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">New Status</Label>
            <Select
              value={status}
              onValueChange={(value: "flagged" | "rejected") =>
                setStatus(value)
              }
            >
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="flagged">Flagged</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              placeholder="Provide a reason for this action..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleFlag} variant="destructive">
            {status === "flagged" ? "Flag Content" : "Reject Content"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
