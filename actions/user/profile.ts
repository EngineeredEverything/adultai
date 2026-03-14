"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/utils/auth";

export async function updateProfile(data: {
  name?: string;
  bio?: string;
  coverPhotoUrl?: string;
  avatarUrl?: string;
  username?: string;
  socialLinks?: Record<string, string>;
}) {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };

  // Validate username if provided
  if (data.username !== undefined) {
    const usernameRegex = /^[a-zA-Z0-9_]{3,30}$/;
    if (data.username && !usernameRegex.test(data.username)) {
      return {
        error:
          "Username must be 3-30 characters, alphanumeric and underscore only",
      };
    }

    // Check if username is unique
    if (data.username) {
      const existing = await db.user.findUnique({
        where: { username: data.username },
      });
      if (existing && existing.id !== user.id) {
        return { error: "Username already taken" };
      }
    }
  }

  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        name: data.name,
        bio: data.bio,
        coverPhotoUrl: data.coverPhotoUrl,
        avatarUrl: data.avatarUrl,
        username: data.username,
        socialLinks: data.socialLinks,
      },
    });

    return { success: true, user: updated };
  } catch (error) {
    console.error("Profile update error:", error);
    return { error: "Failed to update profile" };
  }
}

export async function applyForCreator() {
  const user = await currentUser();
  if (!user) return { error: "Unauthorized" };

  try {
    const updated = await db.user.update({
      where: { id: user.id },
      data: {
        isCreator: true,
        creatorAppliedAt: new Date(),
      },
    });

    return { success: true, user: updated };
  } catch (error) {
    console.error("Creator application error:", error);
    return { error: "Failed to apply for creator status" };
  }
}

export async function getPublicProfile(userId: string) {
  try {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        bio: true,
        avatarUrl: true,
        coverPhotoUrl: true,
        username: true,
        isCreator: true,
        creatorVerified: true,
        socialLinks: true,
        createdAt: true,
      },
    });

    if (!user) return { error: "User not found" };

    // Count public images
    const imageCount = await db.generatedImage.count({
      where: {
        userId: userId,
        isPublic: true,
      },
    });

    return {
      success: true,
      profile: {
        ...user,
        imageCount,
      },
    };
  } catch (error) {
    console.error("Get profile error:", error);
    return { error: "Failed to fetch profile" };
  }
}
