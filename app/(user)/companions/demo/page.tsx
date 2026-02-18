import { Suspense } from "react"
import DemoChat from "./DemoChat"
import { redirect } from "next/navigation"

export const metadata = {
  title: "Try Demo - AdultAI Companions",
  description: "Try chatting with an AI companion - no signup required",
}

export default async function DemoPage() {
  // Demo mode - no auth required
  
  return (
    <div className="min-h-screen bg-gray-950">
      <Suspense fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="text-white">Loading demo...</div>
        </div>
      }>
        <DemoChat />
      </Suspense>
    </div>
  )
}
