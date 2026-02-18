"use server";
import { db } from "@/lib/db";
import { Prisma, Role } from "@prisma/client";
import { z } from "zod";
import { currentSession, currentUser } from "@/utils/auth";
import { generateLinksBatch } from "@/lib/cdn";
import {
  getCurrentUserInfoSchema,
  getUserInfoSchema,
  searchUsersSchema,
} from "@/schemas/user";
import { User } from "next-auth";
import {
  getUserImagesDataSchema,
  getUserSessionsDataSchema,
} from "@/schemas/shared-schemas";
import { searchImages } from "../images/info";

// CORE Functions
export const getUsersImagesInfoCORE = async (
  user: User | undefined,
  usersData: { userId: string }[],
  data: z.infer<typeof getUserImagesDataSchema>
) => {
  const users = await db.user.findMany({
    where: { id: { in: usersData.map((u) => u.userId) } },
  });
  if (!users) throw new Error("No users found");

  const images = (
    await Promise.all(
      users.map(async (user) => {
        return await db.userImage.findMany({
          where: {
            userId: user.id,
            // verified: { isSet: true },
            // private: data.private,
          },
          skip: data.limit?.start,
          take: data.limit ? data.limit.end - data.limit.start : undefined,
        });
      })
    )
  ).flat();

  const cdnLinks = await generateLinksBatch(
    images.map((image) => ({ id: image.id, path: image.path || "" }))
  );

  let usersImagesInfo = [];
  for (const user of users) {
    const userImages = images.filter((img) => img.userId === user.id);
    const imagesWithCdnLink = userImages.map((image) => ({
      ...image,
      cdnLink: cdnLinks.find((link) => link.id === image.id)?.link,
    }));

    let count: number | undefined = undefined;
    if (data.count) {
      count = await db.generatedImage.count({
        where: { userId: user.id, verified: { isSet: true } },
      });
    }

    usersImagesInfo.push({
      userId: user.id,
      images: imagesWithCdnLink,
      count,
    });
  }

  return usersImagesInfo;
};

export const getUsersSessionsInfoCORE = async (
  user: User | undefined,
  usersData: { userId: string }[],
  data: z.infer<typeof getUserSessionsDataSchema>
) => {
  const users = await db.user.findMany({
    where: { id: { in: usersData.map((u) => u.userId) } },
  });
  if (!users) throw new Error("No users found");

  const sessions = (
    await Promise.all(
      users.map(async (user) => {
        return await db.session.findMany({
          where: {
            userId: user.id,
            ...(data.active !== undefined
              ? { expires: { gte: new Date() } }
              : {}),
          },
          skip: data.limit?.start,
          take: data.limit ? data.limit.end - data.limit.start : undefined,
        });
      })
    )
  ).flat();

  let usersSessionsInfo = [];
  for (const user of users) {
    const userSessions = sessions.filter(
      (session) => session.userId === user.id
    );
    let count: number | undefined = undefined;
    if (data.count) {
      count = await db.session.count({
        where: {
          userId: user.id,
          ...(data.active !== undefined ? { isActive: data.active } : {}),
        },
      });
    }

    usersSessionsInfo.push({
      userId: user.id,
      sessions: userSessions,
      count,
    });
  }

  return usersSessionsInfo;
};


// RAW Functions
export const getUsersInfoRAW = async (
  user: User | undefined,
  query: { userId: string }[],
  data: z.infer<typeof getUserInfoSchema>["data"]
) => {
  const users = await db.user.findMany({
    where: { id: { in: query.map((q) => q.userId) } },
    select: {
      id: true,
      email: true,
      name: true,
      createdAt: true,
      updatedAt: true,
      role: true,
      system: true,
      emailVerified: true,
      nuts: true,
      images: true,
      isBanned: true,
      isSuspended: true,
      ...(data.role ? { role: true } : {}),
      accounts: {
        select: {
          provider: true,
          providerAccountId: true
        }
      },
      generatedImages: {
        take: 1,
        orderBy: { createdAt: "desc" },
        where: {
          status: "completed",
        },
        select: {
          imageUrl: true,
          id: true,
          width: true,
          height: true,
          prompt: true,
        }
      }
    }
  });
  if (!users) throw new Error("No users found");

  let imagesInfo;
  let sessionsInfo;
  let subscriptionInfo
  if (data.images) {
    imagesInfo = await getUsersImagesInfoCORE(user, query, data.images);
  }

  if (data.sessions) {
    sessionsInfo = await getUsersSessionsInfoCORE(user, query, data.sessions);
  }



  if (data.subscription) {
    subscriptionInfo = await db.subscription.findMany({
      where: {
        userId: {
          in: query.map((q) => q.userId
          )
        }
      },
    }
    )
  }

  const usersInfo = [];
  for (const targetUser of users) {
    let images = imagesInfo?.find((i) => i.userId === targetUser.id);
    let sessions = sessionsInfo?.find((s) => s.userId === targetUser.id);
    let subscription = subscriptionInfo?.find((s) => s.userId === targetUser.id);
    usersInfo.push({
      user: targetUser,
      images: images
        ? { images: images.images, count: images.count }
        : undefined,
      sessions: sessions
        ? { sessions: sessions.sessions, count: sessions.count }
        : undefined,
      subscription: subscription
        ? { subscription: subscription }
        : undefined,
    });
  }

  return usersInfo;
};

export const searchUsersInfoRAW = async (
  user: User | undefined,
  query: z.infer<typeof searchUsersSchema>["query"],
  filters: z.infer<typeof searchUsersSchema>["filters"],
  data: z.infer<typeof searchUsersSchema>["data"]
) => {
  const q = query ?? "";
  const searchQuery: Prisma.UserWhereInput = {
    OR: [
      { name: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ],
    AND: [
      // Role filter
      filters?.role && filters.role.length > 0
        ? {
          role: {
            in: filters.role
              .filter((id): id is string => id !== undefined)
              .map((id) => id as Role),
          },
        }
        : {},

      // Status filter (corrected)
      filters?.status && filters.status.length > 0
        ? {
          OR: filters.status.map((status) => {
            if (status === "active") {
              return {
                isBanned: false,
                isSuspended: false,
              };
            }
            if (status === "suspended") {
              return {
                isSuspended: true,
              };
            }
            if (status === "banned") {
              return {
                isBanned: true,
              };
            }
            return {}; // fallback (shouldn't happen)
          }),
        }
        : {},

      // Subscription filter
      filters?.subscription && filters.subscription.length > 0
        ? {
          subscription: {
            id: {
              in: filters.subscription.filter((s): s is string => s !== undefined),
            },
          },
        }
        : {},
    ],
  };


  let count: number | undefined = undefined;
  if (data.count) {
    count = await db.user.count({
      where: searchQuery,
    });
  }

  const users = await db.user.findMany({
    where: searchQuery,
    skip: data.limit?.start,
    take: data.limit ? data.limit.end - data.limit.start : undefined,
    orderBy:{ 
      generatedImages: {
        _count: "desc",
      }
    }
  });

  if (!users || users.length === 0) throw new Error("No users found");

  const usersInfo = await getUsersInfoRAW(
    user,
    users.map((user) => ({ userId: user.id })),
    data.users
  );

  return { users: usersInfo, count };
};
// Main Functions
export const userInfo = async () => {
  const user = await currentUser();
  if (!user) {
    return { error: "Unauthorized" };
  }
  return { user };
};

export const searchUsers = async (
  query: z.infer<typeof searchUsersSchema>["query"],
  filters: z.infer<typeof searchUsersSchema>["filters"],
  data: z.infer<typeof searchUsersSchema>["data"]
) => {
  const user = await currentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }
  const hasPermission = (user.role === "ADMIN") || (user.role === "MODERATOR");
  if (!hasPermission) {
    return { error: "Not authorized" };
  }

  // For regular users, remove confidential data access
  const publicData: z.infer<typeof searchUsersSchema>["data"] = {
    ...data,
    users: {
      ...data.users,
      images: { ...data.users.images, private: false },
      sessions: undefined,
      preferences: undefined,
    },
  };

  const validatedFields = searchUsersSchema.safeParse({
    query,
    filters,
    data: publicData,
  });
  if (!validatedFields.success) {
    return {
      error: validatedFields.error.issues
        .map((err) => `${err.path.join(".")}:${err.message}`)
        .join(", "),
    };
  }

  try {
    return await searchUsersInfoRAW(
      user,
      validatedFields.data.query,
      validatedFields.data.filters,
      validatedFields.data.data
    );
  } catch (error: any) {
    return { error: error.message };
  }
};

export const sessionInfo = async () => {
  return await currentSession();
};

export const getCurrentUserInfo = async (
  data: z.infer<typeof getCurrentUserInfoSchema>
) => {
  const user = await currentUser();
  if (!user) return { error: "Not authenticated" };

  const validatedFields = getCurrentUserInfoSchema.safeParse(data);
  if (!validatedFields.success) {
    return { error: validatedFields.error.toString() };
  }

  try {
    const userInfo = await getUsersInfoRAW(
      user,
      [{ userId: user.id }],
      validatedFields.data
    );
    return userInfo[0];
  } catch (error: any) {
    return { error: error.message };
  }
};
