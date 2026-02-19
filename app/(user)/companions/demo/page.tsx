import { Suspense } from "react"
import { db } from "@/lib/db"
import DemoChat from "./DemoChat"

export const metadata = {
  title: "Try Demo - AdultAI Companions",
  description: "Try chatting with an AI companion - no signup required",
}

interface Props {
  searchParams: Promise<{ character?: string }>
}

export default async function DemoPage({ searchParams }: Props) {
  const { character: slug } = await searchParams

  // Fetch the requested companion, or pick a featured one
  let companion = null

  if (slug) {
    companion = await db.companion.findFirst({
      where: { slug },
      select: { name: true, slug: true, personality: true, imageUrl: true, archetype: true, description: true },
    })
  }

  // Default to first featured companion if none specified
  if (!companion) {
    companion = await db.companion.findFirst({
      where: { featured: true },
      select: { name: true, slug: true, personality: true, imageUrl: true, archetype: true, description: true },
      orderBy: { createdAt: "asc" },
    })
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }>
        <DemoChat companion={companion} />
      </Suspense>
    </div>
  )
}
