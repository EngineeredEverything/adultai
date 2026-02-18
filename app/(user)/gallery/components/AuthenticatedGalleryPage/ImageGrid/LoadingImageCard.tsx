"use client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { motion } from "framer-motion";

export function LoadingImageCard({
  index,
  position,
  width,
  debug = false,
  skeleton = false,
}: {
  index: number;
  position: { x: number; y: number; height: number };
  width: number;
  debug?: boolean;
  skeleton?: boolean;
}) {
  // Different animation delays for staggered effect
  const delay = Math.min(index * 0.1, 1);

  return (
    <motion.div
      className="absolute rounded-lg overflow-hidden bg-gray-100"
      initial={{ opacity: 0 }}
      animate={{
        opacity: 1,
        top: position.y,
        left: position.x,
      }}
      transition={{
        duration: 0.3,
        top: { duration: 0 },
        left: { duration: 0 },
      }}
      style={{
        width: `${width}px`,
        height: `${position.height}px`,
      }}
    >
      {debug && (
        <div
          className="absolute text-xs text-white bg-black/70 px-1 rounded z-50"
          style={{ top: 0, left: 0 }}
        >
          P{index}: y={Math.round(position.y)} h={Math.round(position.height)}
        </div>
      )}

      {skeleton ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
        </div>
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <LoadingSpinner size="lg" className="text-gray-400 mb-2" />
          <p className="text-sm text-gray-400">Generating image...</p>
        </div>
      )}

      {/* Subtle animation to indicate loading */}
      <div className="absolute inset-0 bg-gradient-to-r from-gray-100 to-gray-200 opacity-30">
        <motion.div
          className="h-full w-1/4 bg-white opacity-30"
          animate={{
            x: ["0%", "400%"],
          }}
          transition={{
            repeat: Number.POSITIVE_INFINITY,
            duration: 1.5,
            ease: "linear",
            delay,
          }}
        />
      </div>
    </motion.div>
  );
}
