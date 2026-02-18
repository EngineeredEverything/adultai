"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { updateImageInfo } from "@/actions/images/update"
import { toast } from "sonner"
import { Loader2, Globe, Lock, Download, Trash2 } from "lucide-react"
import type { SearchImagesResponseSuccessType } from "@/types/images"

interface GeneratedImagePreviewProps {
  images: SearchImagesResponseSuccessType["images"]
  onPublish?: (imageId: string) => void
  onDelete?: (imageId: string) => void
  onClear?: () => void
}

export function GeneratedImagePreview({
  images,
  onPublish,
  onDelete,
  onClear,
}: GeneratedImagePreviewProps) {
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())

  if (images.length === 0) return null

  const handlePublish = async (imageId: string) => {
    setPublishingIds((prev) => new Set(prev).add(imageId))
    
    try {
      const result = await updateImageInfo({
        imageId,
        isPublic: true,
      })

      if ("error" in result) {
        toast.error("Failed to publish image")
      } else {
        toast.success("Image published to gallery!")
        onPublish?.(imageId)
      }
    } catch (error) {
      console.error("Error publishing image:", error)
      toast.error("Failed to publish image")
    } finally {
      setPublishingIds((prev) => {
        const next = new Set(prev)
        next.delete(imageId)
        return next
      })
    }
  }

  const handleDelete = async (imageId: string) => {
    setDeletingIds((prev) => new Set(prev).add(imageId))
    // Call parent handler which will remove from preview
    onDelete?.(imageId)
  }

  const handleDownload = async (imageUrl: string, imageId: string) => {
    try {
      const response = await fetch(imageUrl)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `adultai-${imageId}.png`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Image downloaded!")
    } catch (error) {
      console.error("Error downloading image:", error)
      toast.error("Failed to download image")
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 space-y-4"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Lock className="w-5 h-5 text-yellow-500" />
          Your Generated Images (Private)
        </h3>
        {images.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClear}
            className="text-sm text-gray-400 hover:text-white"
          >
            Clear All
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {images.map((item) => {
            const image = item.image
            const isPublishing = publishingIds.has(image.id)
            const isDeleting = deletingIds.has(image.id)
            const isProcessing = image.status === "processing"

            return (
              <motion.div
                key={image.id}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all"
              >
                {/* Image */}
                <div className="aspect-[4/5] relative">
                  {image.imageUrl ? (
                    <img
                      src={image.imageUrl}
                      alt={image.prompt}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-gray-800">
                      <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                    </div>
                  )}

                  {/* Processing overlay */}
                  {isProcessing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-300">Generating...</p>
                      </div>
                    </div>
                  )}

                  {/* Publishing overlay */}
                  {isPublishing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                        <p className="text-sm text-gray-300">Publishing...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info & Actions */}
                {!isProcessing && image.imageUrl && (
                  <div className="p-3 space-y-2">
                    {/* Prompt */}
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {image.prompt}
                    </p>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handlePublish(image.id)}
                        disabled={isPublishing || isDeleting}
                        className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                      >
                        {isPublishing ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Publishing
                          </>
                        ) : (
                          <>
                            <Globe className="w-4 h-4 mr-2" />
                            Publish
                          </>
                        )}
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDownload(image.imageUrl!, image.id)}
                        disabled={isPublishing || isDeleting}
                        className="border-gray-700"
                      >
                        <Download className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(image.id)}
                        disabled={isPublishing || isDeleting}
                        className="border-gray-700 hover:border-red-500 hover:text-red-500"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>

      <div className="text-center py-2">
        <p className="text-sm text-gray-400">
          <Lock className="w-4 h-4 inline mr-1" />
          These images are private and only visible to you. Click &quot;Publish&quot; to add them to the public gallery.
        </p>
      </div>
    </motion.div>
  )
}
