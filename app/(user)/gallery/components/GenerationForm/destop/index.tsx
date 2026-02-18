"use client";

import type React from "react";
import { memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import ImageGeneratorForm from "../image-generator-form";
import type { Dispatch, SetStateAction } from "react";
import Link from "next/link";
import Image from "next/image";
import type { GetCurrentUserInfoSuccessType } from "@/types/user";
import type { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";

interface InputSectionProps {
  isScrolled: boolean;
  prompt: string;
  setPrompt: (value: SetStateAction<string>) => void;
  isGenerating: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  user: GetCurrentUserInfoSuccessType | undefined;
  userNuts: number | undefined;
  setRatio: (ratio: { width: number; height: number }) => void;
  ratio: { width: number; height: number };
  subscriptionStatus: GetSubscriptionInfoSuccessType | null;
  isPublic: boolean;
  setIsPublic: Dispatch<SetStateAction<boolean>>;
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
}

// Memoized title component to prevent unnecessary re-renders
const AnimatedTitle = memo(({ isScrolled }: { isScrolled: boolean }) => (
  <AnimatePresence mode="sync">
    {!isScrolled && (
      <motion.h1
        className="text-3xl font-bold mb-8"
        initial={{ opacity: 0, height: 0, marginBottom: 0 }}
        animate={{ opacity: 1, height: "auto", marginBottom: 32 }}
        exit={{ opacity: 0, height: 0, marginBottom: 0 }}
        transition={{ duration: 0.2 }}
        key="title"
      >
        What will you create?
      </motion.h1>
    )}
  </AnimatePresence>
));

AnimatedTitle.displayName = "AnimatedTitle";

// Memoized mobile header to prevent unnecessary re-renders
const MobileHeader = memo(() => (
  <div className="md:hidden flex items-center justify-between">
    <Link href="/" className="px-4 flex items-center space-x-2">
      <Image src="/logo.png" alt="Logo" width={32} height={32} />
      <span className="font-bold text-xl">AdultAI</span>
    </Link>
  </div>
));

MobileHeader.displayName = "MobileHeader";

export default memo(function InputSection(props: InputSectionProps) {
  const {
    isScrolled,
    prompt,
    setPrompt,
    isGenerating,
    handleSubmit,
    user,
    userNuts,
    setRatio,
    ratio,
    subscriptionStatus,
    isPublic,
    setIsPublic,
    count,
    setCount,
  } = props;

  return (
    <motion.div
      className={`top-0 left-0 right-0 z-40 transition-all duration-300 w-full ${
        isScrolled ? "bg-primary shadow-md absolute" : "bg-transparent relative"
      }`}
      animate={{
        maxHeight: isScrolled ? "64px" : "500px",
      }}
      transition={{
        duration: 0.2,
        ease: [0.4, 0, 0.2, 1],
      }}
    >
      <div className="max-w-7xl mx-auto px-4">
        <div className="hidden md:block">
          <motion.div
            className={`flex items-center ${
              isScrolled ? "justify-between" : "flex-col"
            }`}
            animate={{
              paddingTop: isScrolled ? "8px" : "24px",
              paddingBottom: isScrolled ? "8px" : "24px",
            }}
            transition={{ duration: 0.3 }}
          >
            <AnimatedTitle isScrolled={isScrolled} />

            <motion.div
              className={isScrolled ? "w-full" : "w-full text-center"}
              animate={{
                width: "100%",
                maxWidth: isScrolled ? "100%" : "800px",
              }}
              transition={{ duration: 0.3 }}
            >
              <ImageGeneratorForm
                userNuts={userNuts}
                user={user}
                prompt={prompt}
                setPrompt={setPrompt}
                isGenerating={isGenerating}
                compact={isScrolled}
                handleSubmit={handleSubmit}
                setRatio={setRatio}
                ratio={ratio}
                subscriptionStatus={subscriptionStatus}
                isPublic={isPublic}
                setIsPublic={setIsPublic}
                count={count}
                setCount={setCount}
              />
            </motion.div>
          </motion.div>
        </div>

        <MobileHeader />
      </div>
    </motion.div>
  );
});
