import { currentUser } from "@/utils/auth"
import { redirect } from "next/navigation"
import { getCharacter } from "@/actions/characters/create"
import ChatInterface from "./ChatInterface"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ChatPage({ params }: Props) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/auth/login?callbackUrl=/companions/${id}/chat`)

  // Only fetch character metadata — no history load on server
  // History is loaded client-side after mount for fast initial render
  const charResult = await getCharacter(id)
  if ("error" in charResult || !charResult.character) {
    redirect("/companions")
  }

  return (
    <ChatInterface
      character={charResult.character}
      initialMessages={[]}
      userId={user.id}
    />
  )
}
