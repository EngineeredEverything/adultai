"use server"

import { currentUser } from "@/utils/auth"
import { db } from "@/lib/db"
import type { Metadata } from "next"
import AuthenticatedGalleryPage from "../../components/AuthenticatedGalleryPage"
import { notFound } from "next/navigation"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

interface PageProps {
  params: Promise<{ userId: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { userId } = await params
  const creator = await db.user.findUnique({
    where: { id: userId },
    select: { name: true },
  })

  const name = creator?.name || "Creator"

  return {
    title: `${name}'s Gallery | AdultAI`,
    description: `Browse AI-generated images by ${name} on AdultAI.`,
  }
}

export default async function CreatorGalleryPage({ params, searchParams }: PageProps) {
  const { userId } = await params
  const resolvedSearchParams = await searchParams

  // Verify creator exists and fetch full profile
  const creator = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      bio: true,
      avatarUrl: true,
      coverPhotoUrl: true,
      username: true,
      isCreator: true,
      creatorVerified: true,
      socialLinks: true,
      email: true,
    },
  })

  if (!creator) return notFound()

  const user = await currentUser()
  const searchQuery = typeof resolvedSearchParams.search === "string" ? resolvedSearchParams.search : ""

  // Count public images
  const imageCount = await db.generatedImage.count({
    where: {
      userId: creator.id,
      isPublic: true,
    },
  })

  const initials = creator.name
    ?.split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase() || "?"

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Cover Photo Banner */}
      <div className="relative h-48 bg-gray-900 border-b border-gray-800 overflow-hidden">
        {creator.coverPhotoUrl ? (
          <img
            src={creator.coverPhotoUrl}
            alt="Cover"
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-r from-gray-900 to-gray-800" />
        )}
      </div>

      {/* Profile Card */}
      <div className="max-w-6xl mx-auto px-4 -mt-16 relative z-10 mb-8">
        <Card className="bg-gray-900 border-gray-800 p-6">
          <div className="flex items-start gap-6">
            {/* Avatar */}
            <Avatar className="w-24 h-24 border-4 border-gray-950">
              <AvatarImage
                src={creator.avatarUrl || ""}
                alt={creator.name || "Creator"}
              />
              <AvatarFallback className="bg-gray-800 text-white text-xl">
                {initials}
              </AvatarFallback>
            </Avatar>

            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-white">
                  {creator.name || "Unknown Creator"}
                </h1>
                {creator.username && (
                  <span className="text-gray-400">@{creator.username}</span>
                )}
                {creator.creatorVerified && (
                  <Badge variant="default" className="bg-blue-600">
                    Verified Creator
                  </Badge>
                )}
              </div>

              {creator.bio && (
                <p className="text-gray-300 mb-3">{creator.bio}</p>
              )}

              {/* Social Links */}
              {creator.socialLinks && typeof creator.socialLinks === "object" && (
                <div className="flex gap-3 mb-4">
                  {(creator.socialLinks as any).twitter && (
                    <a
                      href={`https://twitter.com/${(creator.socialLinks as any).twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:text-blue-300 text-sm"
                    >
                      Twitter
                    </a>
                  )}
                  {(creator.socialLinks as any).instagram && (
                    <a
                      href={`https://instagram.com/${(creator.socialLinks as any).instagram}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-pink-400 hover:text-pink-300 text-sm"
                    >
                      Instagram
                    </a>
                  )}
                  {(creator.socialLinks as any).reddit && (
                    <a
                      href={`https://reddit.com/u/${(creator.socialLinks as any).reddit}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-orange-400 hover:text-orange-300 text-sm"
                    >
                      Reddit
                    </a>
                  )}
                  {(creator.socialLinks as any).website && (
                    <a
                      href={(creator.socialLinks as any).website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-400 hover:text-green-300 text-sm"
                    >
                      Website
                    </a>
                  )}
                </div>
              )}

              {/* Stats */}
              <div className="text-sm text-gray-400">
                <span>{imageCount} public image{imageCount !== 1 ? "s" : ""}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Gallery */}
      <div className="max-w-6xl mx-auto px-4">
        <AuthenticatedGalleryPage
          userId={creator.id}
          creatorName={creator.name || "Unknown Creator"}
          userMode={false}
          searchQuery={searchQuery}
          currentUserId={user?.id}
        />
      </div>
    </div>
  )
}
