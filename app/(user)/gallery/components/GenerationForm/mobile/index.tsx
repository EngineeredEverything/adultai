"use client";

import { Dispatch, SetStateAction } from "react";
import { motion } from "framer-motion";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Camera, ChevronDown, X } from "lucide-react";
import ImageGeneratorForm from "../image-generator-form";
import { SubscriptionStatus } from "@/app/(user)/gallery/components/GenerationForm/subscription-utils";
import { GetCurrentUserInfoSuccessType } from "@/types/user";
import { GetSubscriptionInfoSuccessType } from "@/types/subscriptions";

interface MobileGenerateSheetProps {
  onClose: () => void;
  isScrolled: boolean;
  prompt: string;
  setPrompt: (value: SetStateAction<string>) => void;
  isGenerating: boolean;
  handleSubmit: (e: React.FormEvent) => void;
  user: GetCurrentUserInfoSuccessType | undefined;
  userNuts: number | undefined;
  setRatio: (ratio: { width: number; height: number }) => void;
  ratio: {
    width: number;
    height: number;
  };
  subscriptionStatus?: GetSubscriptionInfoSuccessType | null;
  isPublic: boolean;
  setIsPublic: Dispatch<SetStateAction<boolean>>;
  count: number;
  setCount: Dispatch<SetStateAction<number>>;
  selectedModel?: string;
  setSelectedModel?: (model: string) => void;
  selectedStyle?: string;
  setSelectedStyle?: (style: string) => void;
}

export default function MobileGenerateSheet({
  onClose,
  isScrolled,
  prompt,
  setPrompt,
  isGenerating,
  handleSubmit,
  user,
  userNuts,
  setRatio,
  ratio,
  isPublic,
  subscriptionStatus,
  setIsPublic,
  count,
  setCount,
  selectedModel,
  setSelectedModel,
  selectedStyle,
  setSelectedStyle,
}: MobileGenerateSheetProps) {

  return (
    <motion.div
      className="fixed inset-0 z-50 bg-black/70 flex flex-col justify-end"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div
        className="bg-background rounded-t-xl p-4 pb-8"
        initial={{ y: "100%" }}
        animate={{ y: 0 }}
        exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 30, stiffness: 300 }}
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">Create new image</h2>
          <motion.button onClick={onClose} whileTap={{ scale: 0.9 }}>
            <X className="w-6 h-6" />
          </motion.button>
        </div>

        <div className="space-y-4">
          {/* <Textarea
            placeholder="Describe what you want to see"
            className="min-h-24 bg-zinc-800 border-zinc-700 text-white resize-none rounded-lg"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />

          <div className="overflow-x-auto hide-scrollbar pb-2">
            <div className="flex gap-2 w-max">
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 whitespace-nowrap"
                  >
                    {aspectRatio} <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 bg-zinc-900 border-zinc-800">
                  <AspectRatioSelector
                    currentRatio={aspectRatio}
                    onSelect={handleAspectRatioChange}
                    width={width}
                    height={height}
                  />
                </PopoverContent>
              </Popover>

              <Button
                variant="outline"
                size="sm"
                className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 whitespace-nowrap"
              >
                3.0 Default x 4 <ChevronDown className="ml-1 h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 whitespace-nowrap"
              >
                MP Auto <ChevronDown className="ml-1 h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 whitespace-nowrap"
              >
                Style <ChevronDown className="ml-1 h-4 w-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700 whitespace-nowrap"
              >
                Color <ChevronDown className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="bg-zinc-800 border-zinc-700 text-white hover:bg-zinc-700">
              <Camera className="h-4 w-4" />
            </Button>

            <Button variant="default" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 w-full">
              Generate
            </Button>
          </div> */}
          <ImageGeneratorForm
            userNuts={userNuts}
            user={user}
            prompt={prompt}
            setPrompt={setPrompt}
            isGenerating={isGenerating}
            compact={false}
            handleSubmit={handleSubmit}
            setRatio={setRatio}
            ratio={ratio}
            setIsPublic={setIsPublic}
            isPublic={isPublic}
            subscriptionStatus={subscriptionStatus}
            count={count}
            setCount={setCount}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            selectedStyle={selectedStyle}
            setSelectedStyle={setSelectedStyle}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
