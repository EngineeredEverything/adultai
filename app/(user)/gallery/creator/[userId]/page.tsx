"use server"

import { currentUser } from "@/utils/auth"
import { db } from "@/lib/db"
import type { Metadata } from "next"
import AuthenticatedGalleryPage from "../../components/AuthenticatedGalleryPage"
import { notFound } from "next/navigation"

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

  // Verify creator exists
  const creator = await db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  })

  if (!creator) return notFound()

  const user = await currentUser()
  const searchQuery = typeof resolvedSearchParams.search === "string" ? resolvedSearchParams.search : ""

  return (
    <AuthenticatedGalleryPage
      userId={creator.id}
      creatorName={creator.name || "Unknown Creator"}
      userMode={false}
      searchQuery={searchQuery}
      currentUserId={user?.id}
    />
  )
}
