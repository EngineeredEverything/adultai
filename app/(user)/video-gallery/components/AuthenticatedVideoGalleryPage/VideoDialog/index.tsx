"use client"

import type React from "react"

import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"
import { X, Trash2, MessageCircle, Send } from "lucide-react"
import type { SearchVideosResponseSuccessType } from "@/types/videos"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

interface VideoDialogProps {
  isOpen: boolean
  onClose: () => void
  video: SearchVideosResponseSuccessType["videos"][number] | null
  user: any
  onDelete: (videoId: string) => void
  subscriptionStatus: any
  setSelectedVideo: (video: SearchVideosResponseSuccessType["videos"][number] | null) => void
}

export function VideoDialog({
  isOpen,
  onClose,
  video,
  user,
  onDelete,
  subscriptionStatus,
  setSelectedVideo,
}: VideoDialogProps) {
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen && video) {
      if (video.comments) {
        setComments(video.comments.comments || [])
      } else {
        setComments([])
      }
    }
  }, [isOpen, video])

  useEffect(() => {
    if (!isOpen) {
      setNewComment("")
      setComments([])
    }
  }, [isOpen])

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user || !video || !newComment.trim() || isLoading) return

    toast.info("Comments feature coming soon!")
  }

  const handleDelete = () => {
    if (!video) return
    const confirmed = window.confirm("Are you sure you want to delete this video?")
    if (confirmed) {
      onDelete(video.video.id)
      onClose()
    }
  }

  if (!video) return null

  const isOwner = user?.user?.id === video.video.userId

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-full max-w-4xl max-h-[95vh] p-0 overflow-hidden">
        <div className="flex flex-col max-h-[95vh]">
          <div className="flex items-center justify-between p-4 border-b bg-white sticky top-0 z-10">
            <div className="flex items-center gap-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={`/placeholder.svg?height=32&width=32`} />
                <AvatarFallback>{video.video.user?.name?.charAt(0) || "U"}</AvatarFallback>
              </Avatar>
              <div>
                <p className="font-semibold text-sm">{video.video.user?.name || "Unknown User"}</p>
                <p className="text-xs text-muted-foreground">{new Date(video.video.createdAt).toLocaleDateString()}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleDelete}
                    className="h-8 px-2 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" onClick={onClose} className="h-8 px-2">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <ScrollArea className="flex-1 max-h-[calc(95vh-69px)]">
            <div className="p-4 space-y-6">
              <div className="relative w-full max-w-2xl mx-auto bg-muted rounded-lg overflow-hidden">
                {video.video.cdnUrl ? (
                  <video src={video.video.cdnUrl} controls className="w-full" style={{ maxHeight: "70vh" }} />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-8">
                    <p className="text-muted-foreground">Video not available</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div className="space-y-3">
                  {video.video.prompt && <p className="text-sm leading-relaxed">{video.video.prompt}</p>}

                  <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                    {video.video.width && video.video.height && (
                      <span className="bg-muted px-2 py-1 rounded">
                        {video.video.width}x{video.video.height}
                      </span>
                    )}
                    {video.video.fps && <span className="bg-muted px-2 py-1 rounded">{video.video.fps} FPS</span>}
                    {video.video.numFrames && (
                      <span className="bg-muted px-2 py-1 rounded">{video.video.numFrames} frames</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-6 py-2">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <MessageCircle className="w-5 h-5" />
                    <span className="font-medium">{comments.length}</span>
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-semibold">Comments</h4>

                  {user && (
                    <form onSubmit={handleComment} className="flex gap-2">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={`/placeholder.svg?height=32&width=32`} />
                        <AvatarFallback>{user.user?.name?.charAt(0) || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 flex gap-2">
                        <Input
                          type="text"
                          value={newComment}
                          onChange={(e) => setNewComment(e.target.value)}
                          placeholder="Add a comment..."
                          disabled={isLoading}
                          className="flex-1"
                        />
                        <Button type="submit" size="sm" disabled={!newComment.trim() || isLoading}>
                          <Send className="w-4 h-4" />
                        </Button>
                      </div>
                    </form>
                  )}

                  <div className="space-y-3">
                    {comments.length > 0 ? (
                      comments.map((comment) => (
                        <div key={comment.id} className="flex gap-3">
                          <Avatar className="h-8 w-8 flex-shrink-0">
                            <AvatarImage src={`/placeholder.svg?height=32&width=32`} />
                            <AvatarFallback>{comment.user.name?.charAt(0) || "U"}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium">{comment.user.name || "Unknown User"}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(comment.createdAt).toLocaleDateString()}
                              </p>
                            </div>
                            <p className="text-sm text-muted-foreground">{comment.comment}</p>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <MessageCircle className="w-12 h-12 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No comments yet</p>
                        <p className="text-xs">Be the first to share your thoughts!</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  )
}
