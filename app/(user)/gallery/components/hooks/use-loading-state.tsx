"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import Image from "next/image";

export function useLoadingState(initialCount = 0) {
  const [pendingCount, setPendingCount] = useState(initialCount);

  // Toast-based loading indicators
  useEffect(() => {
    let toastId: string | number | undefined;

    if (pendingCount > 0) {
      toastId = toast.success(<LoadingToast count={pendingCount} />, {
        className: "w-full max-w-sm",
        duration: Number.POSITIVE_INFINITY, // Don't auto-dismiss
      });
    }

    // Cleanup function
    return () => {
      if (toastId !== undefined) {
        toast.dismiss(toastId);
      }
    };
  }, [pendingCount]);

  // Add a new pending item
  const addPending = () => {
    setPendingCount((prev) => prev + 1);
  };

  // Remove a pending item
  const removePending = () => {
    setPendingCount((prev) => Math.max(0, prev - 1));
  };

  // Set a specific count
  const setPending = (count: number) => {
    setPendingCount(Math.max(0, count));
  };

  // Reset to zero
  // Reset to zero but show placeholder toast before hiding
  const resetPending = ({ images }: { images: (string | undefined)[] }) => {
    // First dismiss any active pending toast
    setPendingCount(0);

    // Show generated images as placeholders
    const toastId = toast.success(<GeneratedImagesToast images={images} />, {
      className: "w-full max-w-sm",
      duration: 2000, // Visible for 10 seconds
    });

    // If you want to manually dismiss after duration (safer than relying solely on duration)
    setTimeout(() => {
      toast.dismiss(toastId);
    }, 2000);
  };

  return {
    pendingCount,
    addPending,
    removePending,
    setPending,
    resetPending,
  };
}

function LoadingToast({ count }: { count: number }) {
  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="font-medium">Generating images</span>
        </div>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-xs font-medium",
            "bg-primary/10 text-primary"
          )}
        >
          {count} pending
        </span>
      </div>

      <div className="space-y-2">
        {Array.from({ length: Math.min(count, 3) }).map((_, index) => (
          <LoadingPlaceholder key={index} index={index} />
        ))}

        {count > 3 && (
          <p className="text-xs text-muted-foreground text-center mt-1">
            +{count - 3} more images being generated
          </p>
        )}
      </div>
    </div>
  );
}
function GeneratedImagesToast({ images }: { images: (string | undefined)[] }) {
  return (
    <div className="w-full space-y-2">
      <p className="font-medium">Generated Images</p>
      <div className="grid grid-cols-3 gap-2">
        {images.slice(0, 3).map((src, index) => (
          <div
            key={index}
            className="w-full h-14 bg-muted rounded-md overflow-hidden"
          >
            {src ? (
              <Image
                width={100}
                height={100}
                src={src}
                alt={`Generated ${index + 1}`}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                N/A
              </div>
            )}
          </div>
        ))}
      </div>
      {images.length > 3 && (
        <p className="text-xs text-muted-foreground">
          +{images.length - 3} more
        </p>
      )}
    </div>
  );
}

function LoadingPlaceholder({ index }: { index: number }) {
  // Different animation delays for staggered effect
  const delay = Math.min(index * 0.1, 1);

  return (
    <div
      className={cn(
        "relative h-14 w-full rounded-md overflow-hidden",
        "bg-muted/50"
      )}
    >
      <div className="absolute inset-0 flex items-center px-3">
        <div className="w-full">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-foreground/70">
              Image {index + 1}
            </span>
            <span className="text-xs text-muted-foreground">Processing...</span>
          </div>

          <div className="mt-2 w-full bg-muted rounded-full h-1.5 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              animate={{
                width: ["15%", "95%", "35%", "85%"],
              }}
              transition={{
                repeat: Number.POSITIVE_INFINITY,
                duration: 3,
                ease: "easeInOut",
                delay,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
