"use server"
import { db } from "@/lib/db"
import { currentUser } from "@/utils/auth"

/** Fetch current user content interests */
export async function getContentInterests(): Promise<string[]> {
  const user = await currentUser()
  if (!user?.id) return []
  const prefs = await db.userPreferences.findUnique({
    where: { userId: user.id },
    select: { contentInterests: true },
  })
  return prefs?.contentInterests ?? []
}

/** Save content interests for current user */
export async function saveContentInterests(interests: string[]): Promise<{ success: boolean }> {
  const user = await currentUser()
  if (!user?.id) return { success: false }
  await db.userPreferences.upsert({
    where: { userId: user.id },
    create: { userId: user.id, contentInterests: interests },
    update: { contentInterests: interests },
  })
  return { success: true }
}
