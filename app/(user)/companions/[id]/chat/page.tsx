import { currentUser } from "@/utils/auth"
import { redirect } from "next/navigation"
import { getCharacter } from "@/actions/characters/create"
import { getChatHistory } from "@/actions/characters/chat"
import ChatInterface from "./ChatInterface"

interface Props {
  params: Promise<{ id: string }>
}

export default async function ChatPage({ params }: Props) {
  const { id } = await params
  const user = await currentUser()
  if (!user) redirect(`/auth/login?callbackUrl=/companions/${id}/chat`)

  const charResult = await getCharacter(id)
  if ("error" in charResult || !charResult.character) {
    redirect("/companions")
  }

  const historyResult = await getChatHistory(id)
  const initialMessages = "messages" in historyResult ? historyResult.messages : []

  return (
    <ChatInterface
      character={charResult.character}
      initialMessages={initialMessages}
      userId={user.id}
    />
  )
}
