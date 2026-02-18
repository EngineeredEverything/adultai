"use server"

import type * as z from "zod"
import bcrypt from "bcryptjs"

import { db } from "@/lib/db"
import type { SettingsSchema } from "@/schemas/settings"
import { currentUser } from "@/utils/auth"
import { generateVerificationToken } from "@/lib/tokens"
import { sendVerificationEmail } from "@/lib/mail"

export const settings = async (values: z.infer<typeof SettingsSchema>) => {
  const user = await currentUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  const dbUser = await db.user.findUnique({
    where: { id: user.id },
    include: {
      accounts: true, // Include accounts to check OAuth provider
    },
  })

  if (!dbUser) {
    return { error: "Unauthorized" }
  }

  // Check if user is using OAuth (Google)
  if (dbUser.accounts?.provider === "google") {
    // Prevent email change for OAuth users
    if (values.email && values.email !== user.email) {
      return { error: "Cannot change email for Google-authenticated accounts" }
    }

    // Prevent password change for OAuth users
    if (values.password || values.newPassword) {
      return { error: "Cannot change password for Google-authenticated accounts" }
    }
  }

  // Handle email change for non-OAuth users
  if (values.email && values.email !== user.email) {
    const existingUser = await db.user.findUnique({
      where: { email: values.email },
    })

    if (existingUser && existingUser.id !== user.id) {
      return { error: "Email already in use!" }
    }

    const verificationToken = await generateVerificationToken(values.email)
    await sendVerificationEmail(verificationToken.email, verificationToken.token)

    return { success: "Verification email sent!" }
  }

  // Handle password change for non-OAuth users
  if (values.password && values.newPassword && dbUser.password) {
    const passwordsMatch = await bcrypt.compare(values.password, dbUser.password)

    if (!passwordsMatch) {
      return { error: "Incorrect password!" }
    }

    const hashedPassword = await bcrypt.hash(values.newPassword, 10)
    values.password = hashedPassword
    values.newPassword = undefined
  }

  // Update user data
  const updatedUser = await db.user.update({
    where: { id: dbUser.id },
    data: {
      ...values,
    },
  })

  return { success: "Settings Updated!" }
}
