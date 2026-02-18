"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { setAgeVerification } from "./verifyAge";
import { useAgeVerification } from "./age-verification-provider";

export function AgeVerification({callbackUrl}: {callbackUrl: string}) {
  const [isVisible, setIsVisible] = useState(true);
  const [rtaImageError, setRtaImageError] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const { setVerified } = useAgeVerification();

  const handleVerification = async (isAdult: boolean) => {
    if (isAdult) {
      await setAgeVerification();
      setVerified(true);
      setIsVisible(false);
      window.location.href = callbackUrl;
    } else {
      window.location.href = "https://www.google.com";
    }
  };

  if (!isVisible) return null;

  // Your existing JSX remains the same
  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen py-8 px-4 flex items-center justify-center">
        <div className="glass-panel w-full max-w-2xl p-6 sm:p-8 text-center animate-appear rounded-lg">
          <div className="mb-6 sm:mb-8">
            {!logoError ? (
              <div className="relative w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] mx-auto mb-4 overflow-hidden rounded-2xl shadow-xl">
                <Image
                  src="/logo.png"
                  alt="AdultAI Logo"
                  fill
                  className="object-cover"
                  priority
                  onError={() => setLogoError(true)}
                />
              </div>
            ) : (
              <div className="w-[100px] h-[100px] sm:w-[120px] sm:h-[120px] mx-auto mb-4 bg-primary/20 rounded-2xl flex items-center justify-center shadow-xl">
                <span className="text-2xl font-bold text-gradient">
                  AdultAI
                </span>
              </div>
            )}
            <h1 className="text-3xl sm:text-4xl font-bold text-gradient mb-2">
              Welcome to AdultAI
            </h1>
            <div className="h-1 w-24 mx-auto bg-gradient-to-r from-primary to-secondary rounded-full"></div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-4 sm:mb-6">
            A safer way to adult
          </h2>

          <div className="max-w-xl mx-auto">
            <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6 leading-relaxed">
              This website contains age-restricted materials including nudity
              and explicit depictions of sexual activity. By entering, you
              affirm that you are at least 18 years of age or the age of
              majority in the jurisdiction you are accessing the website from
              and you consent to viewing sexually explicit content.
            </p>

            <p className="text-primary font-semibold mb-6 sm:mb-8 text-base sm:text-lg">
              Please verify your Age - This Site Contains 18+ Content
            </p>
          </div>

          <div className="flex justify-center items-center gap-4 mb-6 sm:mb-8">
            {!rtaImageError ? (
              <div className="relative w-[80px] h-[32px]">
                <Image
                  src="/images/rta-label.png"
                  alt="RTA Label"
                  fill
                  className="object-contain"
                  priority
                  onError={() => setRtaImageError(true)}
                />
              </div>
            ) : (
              <div className="bg-secondary/50 text-secondary px-4 py-2 rounded-lg flex items-center gap-2 border border-secondary/30">
                <span className="font-bold text-xl">RTA</span>
                <span className="text-xs leading-tight">
                  RESTRICTED
                  <br />
                  TO ADULTS
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <button
              onClick={() => handleVerification(true)}
              className="tech-button w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base"
            >
              I Am 18 Or Older
            </button>
            <button
              onClick={() => handleVerification(false)}
              className="exit-button w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base"
            >
              Exit Site
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
