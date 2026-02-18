"use client"

import type React from "react"

import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Slider } from "@/components/ui/slider"
import { Sparkles } from "lucide-react"

interface VideoGenerationFormProps {
  prompt: string
  setPrompt: (value: string) => void
  isGenerating: boolean
  handleSubmit: (e: React.FormEvent) => void
  count: number
  setCount: (value: number) => void
  fps: number
  setFps: (value: number) => void
  numFrames: number
  setNumFrames: (value: number) => void
  width: number
  setWidth: (value: number) => void
  height: number
  setHeight: (value: number) => void
}

export function VideoGenerationForm({
  prompt,
  setPrompt,
  isGenerating,
  handleSubmit,
  count,
  setCount,
  fps,
  setFps,
  numFrames,
  setNumFrames,
  width,
  setWidth,
  height,
  setHeight,
}: VideoGenerationFormProps) {
  return (
    <Card className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="prompt">Video Prompt</Label>
          <Textarea
            id="prompt"
            placeholder="Describe the video you want to generate..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="min-h-[100px] resize-none"
            disabled={isGenerating}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label htmlFor="width">Width: {width}px</Label>
            <Slider
              id="width"
              min={256}
              max={1920}
              step={64}
              value={[width]}
              onValueChange={(value) => setWidth(value[0])}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="height">Height: {height}px</Label>
            <Slider
              id="height"
              min={256}
              max={1080}
              step={64}
              value={[height]}
              onValueChange={(value) => setHeight(value[0])}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fps">FPS: {fps}</Label>
            <Slider
              id="fps"
              min={12}
              max={60}
              step={6}
              value={[fps]}
              onValueChange={(value) => setFps(value[0])}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="numFrames">Frames: {numFrames}</Label>
            <Slider
              id="numFrames"
              min={24}
              max={240}
              step={12}
              value={[numFrames]}
              onValueChange={(value) => setNumFrames(value[0])}
              disabled={isGenerating}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="count">Count: {count}</Label>
            <Input
              id="count"
              type="number"
              min={1}
              max={5}
              value={count}
              onChange={(e) => setCount(Number.parseInt(e.target.value) || 1)}
              disabled={isGenerating}
            />
          </div>
        </div>

        <Button type="submit" disabled={isGenerating || !prompt.trim()} className="w-full" size="lg">
          {isGenerating ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Generate Video
            </>
          )}
        </Button>
      </form>
    </Card>
  )
}
