"use client";
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
  const delay = Math.min(index * 0.15, 1.2);
  const pulseDelay = (index % 4) * 0.3;

  return (
    <motion.div
      className="absolute rounded-xl overflow-hidden"
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1, top: position.y, left: position.x }}
      transition={{ duration: 0.4, delay, top: { duration: 0 }, left: { duration: 0 } }}
      style={{ width: `${width}px`, height: `${position.height}px` }}
    >
      {debug && (
        <div className="absolute text-xs text-white bg-black/70 px-1 rounded z-50 top-0 left-0">
          P{index}: y={Math.round(position.y)} h={Math.round(position.height)}
        </div>
      )}

      {/* Dark base */}
      <div className="absolute inset-0 bg-gray-900" />

      {/* Shimmer sweep — purple-tinted for AdultAI brand */}
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

      {/* Content */}
      {!skeleton && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
          {/* Animated orb */}
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
            {/* Animated dots */}
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
