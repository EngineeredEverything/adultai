import type { Metadata } from "next"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { SpeakStudio } from "./SpeakStudio"

export const metadata: Metadata = {
  title: "Speak Studio — AdultAI",
  description: "Make your AI companion speak with realistic voice and lip sync.",
}

export default async function SpeakStudioPage({
  searchParams,
}: {
  searchParams: Promise<{ imageUrl?: string }>
}) {
  const session = await auth()
  if (!session?.user) redirect("/")
  const { imageUrl } = await searchParams
  return <SpeakStudio user={session} initialImageUrl={imageUrl} />
}
