"use client";
import { motion } from "framer-motion";

export function LoadingImageCard({
  index,
  skeleton = false,
}: {
  index: number;
  position?: { x: number; y: number; height: number }; // kept for compat, ignored
  width?: number; // kept for compat, ignored
  debug?: boolean; // kept for compat, ignored
  skeleton?: boolean;
}) {
  const pulseDelay = (index % 4) * 0.3;

  return (
    <motion.div
      className="relative rounded-xl overflow-hidden w-full"
      style={{ aspectRatio: "2/3" }} // default portrait skeleton
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4 }}
    >
      {/* Dark base */}
      <div className="absolute inset-0 bg-gray-900" />

      {/* Shimmer sweep */}
      <motion.div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(105deg, transparent 40%, rgba(139,92,246,0.08) 50%, rgba(236,72,153,0.06) 55%, transparent 65%)",
        }}
        animate={{ x: ["-100%", "200%"] }}
        transition={{
          repeat: Infinity,
          duration: 1.8,
          ease: "linear",
          delay: pulseDelay,
        }}
      />

      {/* Subtle border */}
      <div className="absolute inset-0 rounded-xl ring-1 ring-inset ring-white/5" />

      {/* Content (only for generating placeholders, not skeletons) */}
      {!skeleton && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
          <div className="relative w-10 h-10">
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-br from-purple-500/30 to-pink-500/30 blur-md"
              animate={{ scale: [1, 1.3, 1], opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: pulseDelay }}
            />
            <motion.div
              className="absolute inset-2 rounded-full bg-gradient-to-br from-purple-400 to-pink-500"
              animate={{ scale: [0.8, 1, 0.8] }}
              transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: pulseDelay }}
            />
          </div>
          <div className="text-center space-y-1">
            <motion.p
              className="text-xs font-medium text-gray-400"
              animate={{ opacity: [0.5, 1, 0.5] }}
              transition={{ repeat: Infinity, duration: 2, delay: pulseDelay }}
            >
              Generating...
            </motion.p>
            <div className="flex justify-center gap-1">
              {[0, 1, 2].map((i) => (
                <motion.span
                  key={i}
                  className="inline-block w-1 h-1 rounded-full bg-purple-400"
                  animate={{ scale: [0.5, 1, 0.5], opacity: [0.3, 1, 0.3] }}
                  transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 + pulseDelay }}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </motion.div>
  );
}
