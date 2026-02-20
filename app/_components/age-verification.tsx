"use client";

import { useState } from "react";
import { setAgeVerification } from "./verifyAge";
import { useAgeVerification } from "./age-verification-provider";

const TEASER_COMPANIONS = [
  { url: "https://adultai-com.b-cdn.net/companions/vampire-woman.png", name: "Lily" },
  { url: "https://adultai-com.b-cdn.net/companions/alien-woman.png", name: "Nova" },
  { url: "https://adultai-com.b-cdn.net/companions/blonde-athletic.png", name: "Sophia" },
  { url: "https://adultai-com.b-cdn.net/companions/angel-woman.png", name: "Celeste" },
  { url: "https://adultai-com.b-cdn.net/companions/demon-woman.png", name: "Scarlet" },
  { url: "https://adultai-com.b-cdn.net/companions/elf-woman.png", name: "Aelindra" },
];

const FEATURES = [
  { icon: "🎨", label: "Create Characters" },
  { icon: "🎬", label: "Animate & Lip-Sync" },
  { icon: "🎙️", label: "Voice Chat" },
  { icon: "🧠", label: "Remembers You" },
  { icon: "💾", label: "Save & Share" },
  { icon: "✏️", label: "Fully Customize" },
];

export function AgeVerification({ callbackUrl }: { callbackUrl: string }) {
  const [loading, setLoading] = useState(false);
  const { setVerified } = useAgeVerification();

  const handleVerification = async (isAdult: boolean) => {
    if (!isAdult) {
      window.location.href = "https://www.google.com";
      return;
    }
    setLoading(true);
    await setAgeVerification();
    setVerified(true);
    window.location.href = callbackUrl;
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-gray-950">
      {/* Background grid of blurred companion images */}
      <div className="absolute inset-0 grid grid-cols-3 md:grid-cols-6 opacity-30">
        {TEASER_COMPANIONS.map((c, i) => (
          <div key={i} className="relative overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={c.url}
              alt=""
              className="w-full h-full object-cover object-top blur-sm scale-110"
              aria-hidden="true"
            />
          </div>
        ))}
      </div>

      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/80 via-gray-950/60 to-gray-950/90" />
      <div className="absolute inset-0 bg-gradient-to-t from-gray-950 via-transparent to-gray-950/50" />

      {/* Content */}
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-lg text-center">

          {/* Logo */}
          <div className="mb-6">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <span className="text-white font-bold text-lg">A</span>
              </div>
              <span className="text-2xl font-bold text-white tracking-tight">AdultAI</span>
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-3 leading-tight">
            Create. Animate. Chat.{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              No Limits.
            </span>
          </h1>

          <p className="text-gray-300 text-lg mb-6 leading-relaxed">
            Generate AI characters, animate them with lip-sync, voice chat with them, customize every detail — then save and share your creations.
          </p>

          {/* Feature badges */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {FEATURES.map((f, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-white text-sm font-medium"
              >
                <span>{f.icon}</span>
                <span>{f.label}</span>
              </span>
            ))}
          </div>

          {/* Age gate box */}
          <div className="bg-gray-900/80 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-4">
            <p className="text-sm text-gray-400 mb-5 leading-relaxed">
              This site contains adult content (18+) including explicit AI-generated material.
              By entering, you confirm you are at least 18 years old and consent to viewing such content.
            </p>

            <button
              onClick={() => handleVerification(true)}
              disabled={loading}
              className="w-full py-4 rounded-xl font-bold text-white text-lg bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all duration-200 shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed mb-3"
            >
              {loading ? "Entering…" : "Enter — I'm 18+"}
            </button>

            <button
              onClick={() => handleVerification(false)}
              className="w-full py-2.5 rounded-xl text-gray-500 text-sm hover:text-gray-400 transition-colors"
            >
              Exit Site
            </button>
          </div>

          {/* RTA / compliance */}
          <div className="flex items-center justify-center gap-3 text-xs text-gray-600">
            <div className="flex items-center gap-1 bg-gray-800/50 px-2 py-1 rounded">
              <span className="font-bold text-gray-500">RTA</span>
              <span>RESTRICTED TO ADULTS</span>
            </div>
            <span>All content is AI-generated synthetic media.</span>
          </div>
        </div>
      </div>
    </div>
  );
}
