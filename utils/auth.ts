"use server";
import { authOptions } from "@/auth";
import { db } from "@/lib/db";
import { getServerSession } from "next-auth";

/**
 * Retrieves the current session from the server.
 * @returns {Promise<import("next-auth").Session | null>} The current session, or null if no session is active.
 */
export const currentSession = async () => {
  const session = await getServerSession(authOptions);
  return session;
}
/**
 * Retrieves the current authenticated user.
 * @returns {Promise<import("@prisma/client").User | undefined>} The current authenticated user, or undefined if no user is logged in.
 */
export const currentUser = async () => {
  const session = await currentSession()
  if (!session || !session.user) {
    return undefined;
  }
  // Ensure the session user is typed as User
  const dbUser = await db.user.findUnique({
    where: { email: session.user.email as string },
  })

  return dbUser;
};


export type User = Extract<Awaited<ReturnType<typeof currentUser>>, { id: string }>;