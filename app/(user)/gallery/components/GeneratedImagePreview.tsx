"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Button } from "@/components/ui/button"
import { updateImageInfo } from "@/actions/images/update"
import { recordImagePreference } from "@/actions/images/preference"
import { toast } from "sonner"
import { Loader2, Globe, Lock, Download, Trash2, X, ChevronLeft, ChevronRight, RefreshCw, Pencil } from "lucide-react"
import type { SearchImagesResponseSuccessType } from "@/types/images"
import { CategoryPicker } from "./CategoryPicker"

type ImageItem = SearchImagesResponseSuccessType["images"][number]

interface GeneratedImagePreviewProps {
  images: SearchImagesResponseSuccessType["images"]
  pendingCount?: number
  onPublish?: (imageId: string) => void
  onSavePrivate?: (imageId: string) => void
  onDelete?: (imageId: string) => void
  onClear?: () => void
  onRetry?: (prompt: string, modelId?: string) => void
  onEdit?: (prompt: string) => void
}

export function GeneratedImagePreview({
  images,
  pendingCount = 0,
  onPublish,
  onSavePrivate,
  onDelete,
  onClear,
  onRetry,
  onEdit,
}: GeneratedImagePreviewProps) {
  const [publishingIds, setPublishingIds] = useState<Set<string>>(new Set())
  const [savingPrivateIds, setSavingPrivateIds] = useState<Set<string>>(new Set())
  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set())
  // Per-image selected categories
  const [imageCategoryMap, setImageCategoryMap] = useState<Record<string, string[]>>({})
  // Full-size lightbox
  const [viewingImage, setViewingImage] = useState<ImageItem | null>(null)

  const completedImages = images.filter(
    (item) => item.image.status === "completed" && item.image.imageUrl
  )

  if (images.length === 0 && pendingCount === 0) return null

  // Record implicit preference when user saves an image (the saved one is preferred)
  const recordPreferenceOnSave = async (chosenId: string) => {
    if (completedImages.length < 2) return
    const rejected = completedImages
      .filter((img) => img.image.id !== chosenId)
      .map((img) => img.image.id)
    const prompt = completedImages[0]?.image.prompt || ""
    try {
      await recordImagePreference({ chosenImageId: chosenId, rejectedImageIds: rejected, prompt })
    } catch {
      // non-critical
    }
  }

  const handlePublish = async (imageId: string) => {
    setPublishingIds((prev) => new Set(prev).add(imageId))
    try {
      const categoryIds = imageCategoryMap[imageId] || []
      const result = await updateImageInfo(imageId, { isPublic: true, ...(categoryIds.length > 0 && { categoryIds }) })
      if ("error" in result) {
        toast.error("Failed to publish image")
      } else {
        toast.success("Image published to gallery!")
        recordPreferenceOnSave(imageId)
        onPublish?.(imageId)
      }
    } catch (error) {
      console.error("Error publishing image:", error)
      toast.error("Failed to publish image")
    } finally {
      setPublishingIds((prev) => { const n = new Set(prev); n.delete(imageId); return n })
    }
  }

  const handleSavePrivate = async (imageId: string) => {
    setSavingPrivateIds((prev) => new Set(prev).add(imageId))
    try {
      const categoryIds = imageCategoryMap[imageId] || []
      if (categoryIds.length > 0) {
        await updateImageInfo(imageId, { categoryIds })
      }
      toast.success("Saved to your private gallery!")
      recordPreferenceOnSave(imageId)
      onSavePrivate?.(imageId)
    } finally {
      setSavingPrivateIds((prev) => { const n = new Set(prev); n.delete(imageId); return n })
    }
  }

  const handleDelete = async (imageId: string) => {
    setDeletingIds((prev) => new Set(prev).add(imageId))
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
    } catch {
      toast.error("Failed to download image")
    }
  }

  // Lightbox navigation
  const viewingIndex = viewingImage
    ? completedImages.findIndex((img) => img.image.id === viewingImage.image.id)
    : -1
  const canGoPrev = viewingIndex > 0
  const canGoNext = viewingIndex < completedImages.length - 1

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-6 space-y-4"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Lock className="w-5 h-5 text-yellow-500" />
            Your Generated Images
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
            {/* Pending generation placeholders */}
            {Array.from({ length: pendingCount }).map((_, i) => (
              <motion.div
                key={`pending-${i}`}
                layout
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="relative bg-gray-900 rounded-xl overflow-hidden border border-purple-500/30"
              >
                <div className="aspect-[4/5] relative flex items-center justify-center bg-gray-800/50">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Generating...</p>
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse" />
                </div>
              </motion.div>
            ))}

            {images.map((item) => {
              const image = item.image
              const isPublishing = publishingIds.has(image.id)
              const isDeleting = deletingIds.has(image.id)
              const isProcessing = image.status === "processing"
              const isBusy = isPublishing || isDeleting || savingPrivateIds.has(image.id)

              return (
                <motion.div
                  key={image.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group relative bg-gray-900 rounded-xl overflow-hidden border border-gray-800 hover:border-purple-500/50 transition-all"
                >
                  {/* Image — click to view full size */}
                  <div className="aspect-[4/5] relative">
                    {image.imageUrl ? (
                      <img
                        src={image.imageUrl}
                        alt={image.prompt}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-200 hover:scale-[1.02]"
                        onClick={() => setViewingImage(item)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-gray-800">
                        <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
                      </div>
                    )}

                    {isProcessing && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                          <p className="text-sm text-gray-300">Generating...</p>
                        </div>
                      </div>
                    )}

                    {isPublishing && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <div className="text-center">
                          <Loader2 className="w-8 h-8 animate-spin text-purple-500 mx-auto mb-2" />
                          <p className="text-sm text-gray-300">Publishing...</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {!isProcessing && image.imageUrl && (
                    <div className="p-3 space-y-2">
                      <p className="text-sm text-gray-400 line-clamp-2">{image.prompt}</p>

                      {/* Category picker */}
                      <CategoryPicker
                        compact
                        selectedIds={imageCategoryMap[image.id] || []}
                        onChange={(ids) => setImageCategoryMap((prev) => ({ ...prev, [image.id]: ids }))}
                      />

                      <div className="flex flex-col gap-2">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleSavePrivate(image.id)}
                            disabled={isBusy}
                            variant="outline"
                            className="flex-1 border-yellow-600/50 text-yellow-500 hover:bg-yellow-600/10 hover:border-yellow-500"
                          >
                            <Lock className="w-4 h-4 mr-1.5" />
                            Save Private
                          </Button>
                          <Button
                            size="sm"
                            onClick={() => handlePublish(image.id)}
                            disabled={isBusy}
                            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                          >
                            {isPublishing ? (
                              <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
                            ) : (
                              <Globe className="w-4 h-4 mr-1.5" />
                            )}
                            Save Public
                          </Button>
                        </div>
                        <div className="flex gap-2">
                          {onRetry && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onRetry(image.prompt, image.modelId ?? undefined)}
                              disabled={isBusy}
                              className="flex-1 border-blue-600/50 text-blue-400 hover:bg-blue-600/10"
                            >
                              <RefreshCw className="w-4 h-4 mr-1.5" />
                              Retry
                            </Button>
                          )}
                          {onEdit && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEdit(image.prompt)}
                              disabled={isBusy}
                              className="flex-1 border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/10"
                            >
                              <Pencil className="w-4 h-4 mr-1.5" />
                              Edit
                            </Button>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownload(image.imageUrl!, image.id)}
                            disabled={isBusy}
                            className="flex-1 border-gray-700"
                          >
                            <Download className="w-4 h-4 mr-1.5" />
                            Download
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDelete(image.id)}
                            disabled={isBusy}
                            className="border-gray-700 hover:border-red-500 hover:text-red-500"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
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
            &quot;Save Private&quot; keeps images in your gallery. &quot;Save Public&quot; shares with everyone.
          </p>
        </div>
      </motion.div>

      {/* Full-size lightbox */}
      <AnimatePresence>
        {viewingImage && viewingImage.image.imageUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setViewingImage(null)}
          >
            {/* Close button */}
            <button
              onClick={() => setViewingImage(null)}
              className="absolute top-4 right-4 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>

            {/* Nav: previous */}
            {canGoPrev && (
              <button
                onClick={(e) => { e.stopPropagation(); setViewingImage(completedImages[viewingIndex - 1]) }}
                className="absolute left-4 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
            )}

            {/* Nav: next */}
            {canGoNext && (
              <button
                onClick={(e) => { e.stopPropagation(); setViewingImage(completedImages[viewingIndex + 1]) }}
                className="absolute right-4 z-10 bg-black/60 hover:bg-black/80 text-white rounded-full p-2 transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            )}

            {/* Full-size image */}
            <motion.img
              key={viewingImage.image.id}
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              src={viewingImage.image.imageUrl}
              alt={viewingImage.image.prompt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />

            {/* Category picker for lightbox */}
            <div
              className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-black/70 backdrop-blur-md rounded-2xl px-4 py-2 max-w-[95vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <CategoryPicker
                compact
                selectedIds={imageCategoryMap[viewingImage.image.id] || []}
                onChange={(ids) => setImageCategoryMap((prev) => ({ ...prev, [viewingImage!.image.id]: ids }))}
              />
            </div>

            {/* Bottom action bar */}
            <div
              className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-wrap items-center justify-center gap-2 bg-black/70 backdrop-blur-md rounded-2xl px-4 py-3 max-w-[95vw]"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="sm"
                onClick={() => { handleSavePrivate(viewingImage.image.id); setViewingImage(null) }}
                variant="outline"
                className="border-yellow-600/50 text-yellow-500 hover:bg-yellow-600/10"
              >
                <Lock className="w-4 h-4 mr-1.5" />
                Save Private
              </Button>
              <Button
                size="sm"
                onClick={() => { handlePublish(viewingImage.image.id); setViewingImage(null) }}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Globe className="w-4 h-4 mr-1.5" />
                Save Public
              </Button>
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { onRetry(viewingImage.image.prompt, viewingImage.image.modelId ?? undefined); setViewingImage(null) }}
                  className="border-blue-600/50 text-blue-400 hover:bg-blue-600/10 hover:border-blue-500"
                >
                  <RefreshCw className="w-4 h-4 mr-1.5" />
                  Retry
                </Button>
              )}
              {onEdit && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { onEdit(viewingImage.image.prompt); setViewingImage(null) }}
                  className="border-emerald-600/50 text-emerald-400 hover:bg-emerald-600/10 hover:border-emerald-500"
                >
                  <Pencil className="w-4 h-4 mr-1.5" />
                  Edit
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleDownload(viewingImage.image.imageUrl!, viewingImage.image.id)}
                className="border-gray-600"
              >
                <Download className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { handleDelete(viewingImage.image.id); setViewingImage(null) }}
                className="border-gray-600 hover:border-red-500 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </Button>

              {/* Image counter */}
              {completedImages.length > 1 && (
                <span className="text-xs text-gray-400 ml-1">
                  {viewingIndex + 1} / {completedImages.length}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
