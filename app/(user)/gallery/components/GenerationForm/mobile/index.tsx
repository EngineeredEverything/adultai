"use client";

import { Dispatch, SetStateAction, useState } from "react";
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
}: MobileGenerateSheetProps) {
  const [aspectRatio, setAspectRatio] = useState("4:5");
  const [width, setWidth] = useState(896);
  const [height, setHeight] = useState(1120);

  // Ensure dimensions are multiples of 8
  const adjustDimensions = (w: number, h: number) => {
    return {
      width: Math.round(w / 8) * 8,
      height: Math.round(h / 8) * 8,
    };
  };

  const handleAspectRatioChange = (ratio: string) => {
    setAspectRatio(ratio);

    // Update dimensions based on aspect ratio
    const [w, h] = ratio.split(":").map(Number);
    let newWidth, newHeight;

    if (w > h) {
      newWidth = 1120;
      newHeight = (h / w) * newWidth;
    } else {
      newHeight = 1120;
      newWidth = (w / h) * newHeight;
    }

    const adjusted = adjustDimensions(newWidth, newHeight);
    setWidth(adjusted.width);
    setHeight(adjusted.height);
  };

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
        className="bg-white rounded-t-xl p-4 pb-8"
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

            <Button variant="default" size="lg" className="bg-white text-black hover:bg-gray-200 w-full">
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
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
