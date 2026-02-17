import { currentUser } from "@/utils/auth"
import { redirect } from "next/navigation"
import CreateCompanionForm from "./CreateCompanionForm"

export default async function CreateCompanionPage() {
  const user = await currentUser()
  if (!user) redirect("/auth/login?callbackUrl=/companions/create")

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
          Create Your Companion
        </h1>
        <p className="text-gray-400 mb-8">Design your perfect AI companion</p>
        <CreateCompanionForm />
      </div>
    </div>
  )
}
