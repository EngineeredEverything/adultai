"use server";
import { db } from "@/lib/db";
import { User } from "next-auth";
import { z } from "zod";
import { currentUser } from "@/utils/auth";
import {
  updateUserBaseSchema,
  updateUserImageSchema,
  updateUserPreferencesSchema,
  updateUserSessionSchema,
} from "@/schemas/user";
import { lockSchema } from "@/lib/lockSchema";
import { getUsersInfoRAW } from "./info";
import { hash } from "@/utils/password";
import { revalidatePath } from "next/cache";
import { Role } from "@prisma/client";
import { logger } from "@/lib/logger";

export const updateUserDetailsRAW = async (
  reqUser: User | undefined,
  userId: string,
  data: z.infer<typeof updateUserBaseSchema>,
  password?: string
) => {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const updatedUser = await lockSchema(`user-${userId}`, async () =>
    db.user.update({
      where: { id: userId },
      data: {
        ...{
          name: data.name,
          email: data.email,
          system: data.system,
          roleId: data.roleId,
        },
        ...(password ? { password: await hash(password) } : {}),
      },
      select: {
        system: true,
        email: true,
        name: true,
        id: true,
      },
    })
  );

  return { user: updatedUser };
};
export const updateUserImageRAW = async (
  reqUser: User | undefined,
  userId: string,
  imageId: string,
  data: z.infer<typeof updateUserImageSchema>["data"]
) => {
  const user = await getUserById(userId);
  if (!user) throw new Error("User not found");

  const image = await lockSchema(`userImage-${imageId}`, () =>
    db.userImage.findUnique({
      where: { id: imageId, userId },
    })
  );
  if (!image) throw new Error("Image not found");

  const updatedImage = await db.userImage.update({
    where: { id: imageId, userId },
    data: data,
  });

  return { image: updatedImage };
};
// Main Functions
export const updateMyUserDetails = async (
  data: z.infer<typeof updateUserBaseSchema>
) => {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };

  const validatedFields = updateUserBaseSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.issues.map(err=>`${err.path.join('.')}:${err.message}`).join(", ") };
  }

  try {
    return await updateUserDetailsRAW(user, user.id, validatedFields.data);
  } catch (error: any) {
    return { error: error.message };
  }
};
export async function suspendUser(userId: string, reason: string, duration?: string, suspendedBy?: string) {
  try {
    let suspensionExpiresAt: Date | null = null

    if (duration) {
      const now = new Date()
      const durationMatch = duration.match(/^(\d+)([dwmy])$/)

      if (durationMatch) {
        const [, amount, unit] = durationMatch
        const amountNum = Number.parseInt(amount)

        switch (unit) {
          case "d":
            suspensionExpiresAt = new Date(now.getTime() + amountNum * 24 * 60 * 60 * 1000)
            break
          case "w":
            suspensionExpiresAt = new Date(now.getTime() + amountNum * 7 * 24 * 60 * 60 * 1000)
            break
          case "m":
            suspensionExpiresAt = new Date(now.setMonth(now.getMonth() + amountNum))
            break
          case "y":
            suspensionExpiresAt = new Date(now.setFullYear(now.getFullYear() + amountNum))
            break
        }
      }
    }

    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        isSuspended: true,
        suspendedAt: new Date(),
        suspensionReason: reason,
        suspensionExpiresAt,
      },
    })

    revalidatePath("/admin/users")
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error suspending user:", error)
    return { success: false, error: "Failed to suspend user" }
  }
}

export async function unsuspendUser(userId: string) {
  try {
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        isSuspended: false,
        suspendedAt: null,
        suspensionReason: null,
        suspensionExpiresAt: null,
      },
    })

    revalidatePath("/admin/users")
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error unsuspending user:", error)
    return { success: false, error: "Failed to unsuspend user" }
  }
}

export async function banUser(userId: string, reason: string, bannedBy?: string) {
  try {
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        banReason: reason,
        bannedBy,
        // Also suspend when banning
        isSuspended: true,
        suspendedAt: new Date(),
        suspensionReason: `Banned: ${reason}`,
      },
    })

    revalidatePath("/admin/users")
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error banning user:", error)
    return { success: false, error: "Failed to ban user" }
  }
}

export async function unbanUser(userId: string) {
  try {
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedAt: null,
        banReason: null,
        bannedBy: null,
        // Also unsuspend when unbanning
        isSuspended: false,
        suspendedAt: null,
        suspensionReason: null,
        suspensionExpiresAt: null,
      },
    })

    revalidatePath("/admin/users")
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error unbanning user:", error)
    return { success: false, error: "Failed to unban user" }
  }
}

export async function updateUserProfile(
  userId: string,
  data: {
    name?: string
    email?: string
    role?: Role
  },
) {
  try {
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.role && { role: data.role }),
        updatedAt: new Date(),
      },
    })

    revalidatePath("/admin/users")
    return { success: true, user: updatedUser }
  } catch (error) {
    console.error("Error updating user profile:", error)
    return { success: false, error: "Failed to update user profile" }
  }
}

export async function sendMessageToUser(userId: string, message: string, fromUserId?: string) {
  try {
    // This would typically create a notification or message record
    // For now, we'll just log it and return success
    logger.info(`Message sent to user ${userId}: ${message}`)

    // You might want to create a Message or Notification model
    // const notification = await db.notification.create({
    //   data: {
    //     userId,
    //     message,
    //     fromUserId,
    //     type: 'ADMIN_MESSAGE',
    //   },
    // })

    revalidatePath("/admin/users")
    return { success: true, message: "Message sent successfully" }
  } catch (error) {
    console.error("Error sending message:", error)
    return { success: false, error: "Failed to send message" }
  }
}

export async function getUserById(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      include: {
        images: true,
        sessions: true,
        subscription: true,
      },
    })

    return { success: true, user }
  } catch (error) {
    console.error("Error fetching user:", error)
    return { success: false, error: "Failed to fetch user" }
  }
}
