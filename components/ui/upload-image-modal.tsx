"use client"

import { useRef, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { AlertTriangle, Upload, ImageIcon, Loader2, CheckCircle2 } from "lucide-react"

interface UploadImageModalProps {
  isOpen: boolean
  onClose: () => void
  onUploadComplete: (url: string) => void
  title?: string
  description?: string
}

export function UploadImageModal({
  isOpen,
  onClose,
  onUploadComplete,
  title = "Upload Your Image",
  description = "Upload an image to animate, remix, or create a talking avatar.",
}: UploadImageModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [dragging, setDragging] = useState(false)

  // Consent checkboxes
  const [consent, setConsent] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [purposeConfirmed, setPurposeConfirmed] = useState(false)

  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const allChecked = consent && ageConfirmed && purposeConfirmed
  const canUpload = allChecked && !!file && !uploading

  function handleFileChange(selected: File) {
    if (!selected.type.startsWith("image/")) {
      setError("Only image files are allowed (JPEG, PNG, WebP)")
      return
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("File too large — maximum 10MB")
      return
    }
    setError(null)
    setFile(selected)
    const reader = new FileReader()
    reader.onload = (e) => setPreview(e.target?.result as string)
    reader.readAsDataURL(selected)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileChange(dropped)
  }

  async function handleUpload() {
    if (!canUpload || !file) return
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("consent", "true")
      formData.append("ageConfirmed", "true")
      formData.append("purposeConfirmed", "true")

      const res = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Upload failed")
        return
      }

      setDone(true)
      setTimeout(() => {
        onUploadComplete(data.url)
        handleClose()
      }, 800)

    } catch (err) {
      setError("Network error — please try again")
    } finally {
      setUploading(false)
    }
  }

  function handleClose() {
    setPreview(null)
    setFile(null)
    setConsent(false)
    setAgeConfirmed(false)
    setPurposeConfirmed(false)
    setError(null)
    setDone(false)
    setUploading(false)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-pink-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Drop zone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            className={`relative cursor-pointer rounded-xl border-2 border-dashed transition-colors overflow-hidden
              ${dragging ? "border-pink-500 bg-pink-500/10" : "border-border hover:border-pink-500/50 hover:bg-muted/30"}
              ${preview ? "h-52" : "h-36"}`}
          >
            {preview ? (
              <img
                src={preview}
                alt="Preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full gap-2 p-4">
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground text-center">
                  Click to select or drag & drop an image
                </p>
                <p className="text-xs text-muted-foreground">JPEG, PNG, WebP · max 10MB</p>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleFileChange(e.target.files[0])}
            />
          </div>

          {/* Consent section */}
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
            <div className="flex items-center gap-2 text-amber-500">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              <span className="text-xs font-semibold uppercase tracking-wide">Required Confirmations</span>
            </div>

            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="consent"
                  checked={consent}
                  onCheckedChange={(v) => setConsent(!!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="consent" className="text-sm leading-snug cursor-pointer">
                  I confirm that I own this image or have the explicit consent of every person depicted to use it for AI generation.
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="age"
                  checked={ageConfirmed}
                  onCheckedChange={(v) => setAgeConfirmed(!!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="age" className="text-sm leading-snug cursor-pointer">
                  I confirm that all individuals depicted in this image are 18 years of age or older.
                </Label>
              </div>

              <div className="flex items-start gap-3">
                <Checkbox
                  id="purpose"
                  checked={purposeConfirmed}
                  onCheckedChange={(v) => setPurposeConfirmed(!!v)}
                  className="mt-0.5"
                />
                <Label htmlFor="purpose" className="text-sm leading-snug cursor-pointer">
                  I understand that uploading images of real people without their consent violates AdultAI&apos;s Terms of Service and may result in account termination and legal action.
                </Label>
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <p className="text-sm text-red-500 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {error}
            </p>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleClose}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              className="flex-1 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              onClick={handleUpload}
              disabled={!canUpload}
            >
              {done ? (
                <><CheckCircle2 className="h-4 w-4 mr-2" /> Done</>
              ) : uploading ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</>
              ) : (
                <><Upload className="h-4 w-4 mr-2" /> Upload Image</>
              )}
            </Button>
          </div>

          {/* Legal footer */}
          <p className="text-xs text-muted-foreground text-center">
            All uploads are logged with timestamp and account ID.{" "}
            <a href="/terms" className="underline hover:text-foreground">Terms of Service</a>
            {" · "}
            <a href="/dmca" className="underline hover:text-foreground">DMCA Policy</a>
          </p>
        </div>
      </DialogContent>
    </Dialog>
  )
}
