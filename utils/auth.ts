"use server";
import { cache } from "react";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";

/**
 * Retrieves the current session from the server.
 * Cached per-request so multiple SSR calls only hit NextAuth once.
 */
export const currentSession = cache(async () => {
  const session = await getServerSession(authOptions);
  return session;
});

/**
 * Retrieves the current authenticated user.
 * Cached per-request so multiple SSR calls only hit the DB once.
 */
export const currentUser = cache(async () => {
  const session = await currentSession()
  if (!session || !session.user) {
    return undefined;
  }
  const dbUser = await db.user.findUnique({
    where: { email: session.user.email as string },
  })

  return dbUser;
});


export type User = Extract<Awaited<ReturnType<typeof currentUser>>, { id: string }>;