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
import { AlertTriangle } from "lucide-react";

export function DeleteModal({
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
  onConfirm?: (imageId: string, reason?: string) => void;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");

  const handleDelete = () => {
    onConfirm?.(image.id, reason);
    setOpen(false);
    setReason("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Delete Image
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertTriangle className="h-4 w-4 text-red-500" />
            <p className="text-sm text-red-700">
              This action cannot be undone. The image will be permanently
              deleted.
            </p>
          </div>

          {/* Image Preview */}
          {image.cdnUrl && (
            <div className="flex justify-center">
              <img
                src={image.cdnUrl || "/placeholder.svg"}
                alt="Image to delete"
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
            <Label htmlFor="reason">Reason for Deletion (Optional)</Label>
            <Textarea
              id="reason"
              placeholder="Provide a reason for deleting this image..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleDelete} variant="destructive">
            Delete Permanently
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
