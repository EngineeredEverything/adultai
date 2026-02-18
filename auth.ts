import NextAuth, { AuthOptions } from "next-auth";

import { PrismaAdapter } from "@auth/prisma-adapter";
import { encode as defaultEncode } from "next-auth/jwt";
import { db } from "@/lib/db";
import authConfig from "@/auth.config";
import {
  createUser as _createUser,
  createUserImageByUrl,
  getAccountByProvider,
  getLoginAttemptByData,
  getSessionByToken,
  getUserByEmail,
  getUserById,
} from "@/utils/user";

import {
  Adapter,
  AdapterAccount,
  AdapterSession,
  AdapterUser,
} from "next-auth/adapters";
import { headers } from "next/headers";
import { PrismaClient, User } from "@prisma/client";
import { getLocationByIp } from "@/lib/location";
import { generateToken, getTwoFactorConfirmationByUserId } from "./lib/tokens";
import { logger } from "@/lib/logger";
const sessionMaxAge =
  parseInt(process.env.SESSION_MAX_AGE || "30") * 24 * 60 * 60 * 1000;
const customPrismaAdapter = (db: PrismaClient): Adapter => {
  const adapter = PrismaAdapter(db) as Adapter;
  return {
    ...adapter,
    async updateUser(user: any) {
      const existingUser = await getUserByEmail(user.email);
      if (!existingUser) throw new Error("User not found");

      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: {
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
        },
      });

      return updatedUser;
    },
    async createUser(user: any) {
      const existingUser = await getUserByEmail(user.email);
      if (existingUser) {
        return existingUser;
      }
      const newUser = await _createUser({
        name: user.name,
        email: user.email,
        emailVerified: user.emailVerified,
      });
      if (!newUser) throw new Error("User not created");
      return newUser;
    },
    async createSession({ sessionToken, userId, expires }) {
      const geoData = await getLocationByIp(
        (await headers()).get("x-user-ip") as string
      );
      if (!geoData) throw new Error("no geo data found");
      const { ip, location } = {
        ip: geoData.ip,
        location: `${geoData.city}-${geoData.country}`,
      };
      const user = await getUserById(userId);
      if (!user) throw new Error("User not found");

      let loginAttempt = await getLoginAttemptByData(user.id, location, ip);
      if (!loginAttempt) {
        const loginAttemptToken = await generateToken("loginAttempt", "token");
        loginAttempt = await db.loginAttempt.create({
          data: {
            location: location,
            ip: ip,
            userId: user.id,
            token: loginAttemptToken,
          },
        });
      }
      if (!loginAttempt) throw new Error("Login attempt not found");

      const session = await db.session.create({
        data: {
          sessionToken,
          userId,
          expires,
          loginAttemptId: loginAttempt.id,
        },
      });
      if (!session) throw new Error("Session not found");
      return {
        sessionId: session.id,
        sessionToken: session.sessionToken,
        userId: session.userId,
        expires: session.expires,
      };
    },
    async getSessionAndUser(
      sessionToken: string
    ): Promise<{ session: AdapterSession; user: AdapterUser } | null> {
      const session = await getSessionByToken(sessionToken);
      if (!session) return null;
      const user = await getUserById(session.userId);
      if (!user) return null;

      return {
        session: {
          sessionToken: session.sessionToken,
          userId: session.userId,
          expires: session.expires,
          sessionId: session.id,
        },
        user: { ...user, sessionId: session.id } as any,
      };
    },
    async getUserByAccount({ providerAccountId, provider }) {
      const account = await getAccountByProvider(provider, providerAccountId);
      if (!account) return null;
      const user = await getUserById(account.userId);
      if (!user) return null;
      return user;
    },
    async deleteSession(sessionToken: string) {
      await db.session.delete({
        where: { sessionToken: sessionToken },
      });
    },
    async updateSession(session: any) {
      const updatedSession = await db.session.update({
        where: { sessionToken: session.sessionToken },
        data: {
          expires: session.expires,
        },
      });
      if (!updatedSession) throw new Error("Session not found");
      return {
        sessionToken: updatedSession.sessionToken,
        sessionId: updatedSession.id,
        expires: updatedSession.expires,
        userId: updatedSession.userId,
      };
    },
    async getUser(id) {
      const user = await getUserById(id);
      return user;
    },
    async getUserByEmail(email) {
      const user = await getUserByEmail(email);
      return user;
    },
  };
};
export const authOptions: AuthOptions = {
  pages: {
    signIn: "/auth/login",
    error: "/auth/error",
  },

  secret: process.env.APP_SECRET,
  events: {
    async linkAccount({ user, profile }) {
      await db.user.update({
        where: { id: user.id },
        data: { emailVerified: new Date() },
      });
      if (profile.image) {
        await createUserImageByUrl(user.id, {
          url: profile.image,
          private: false,
        });
      }
    },
  },

  callbacks: {
    async redirect({ url, baseUrl }) {
      // logger.info("baseUrl", baseUrl);
      // Handle both absolute and relative callback URLs
      if (url.startsWith("/")) {
        // Make relative URL absolute
        return `${baseUrl}${url}`;
      }

      // Handle callback URLs on the same origin
      else if (url && new URL(url).origin === baseUrl) {
        return url;
      }
      // Default to base URL
      return baseUrl;
    },
    async signIn({ user, account, profile }) {
      if (profile?.image) {
        await createUserImageByUrl(user.id, {
          url: profile.image,
          private: false,
        });
      }

      logger.info(account?.provider || "No Provider");
      if (account?.provider === "credentials") {
        const existingUser = user;
        logger.info(existingUser);
        // Prevent sign in without email verification
        if (!existingUser?.emailVerified) {
          logger.error("Email not verified", {
            email: existingUser.email,
          });
          return false;
        }

        if (existingUser.isTwoFactorEnabled) {
          const twoFactorConfirmation = await getTwoFactorConfirmationByUserId(
            existingUser.id
          );

          if (!twoFactorConfirmation) return false;

          // Delete two factor confirmation for next sign in
          await db.twoFactorConfirmation.delete({
            where: { id: twoFactorConfirmation.id },
          });
        }
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (account?.provider === "credentials") {
        token.credentials = true;
      }
      return token;
    },
    async session({ session, user }) {
      if (user) {
        session.user.id = user.id;
        session.user.name = user.name;
        session.user.email = user.email;
        session.user.createdAt = user.createdAt;
        session.user.role = user.role;
        session.sessionId = (user as any).sessionId;
      }

      return session;
    },
  },

  adapter: customPrismaAdapter(db),
  jwt: {
    encode: async function (params) {
      if (params.token?.credentials) {
        const sessionToken = await generateToken("session", "sessionToken");

        if (!params.token.sub) {
          throw new Error("No user ID found in token");
        }
        const createdSession = await customPrismaAdapter(db)?.createSession?.({
          sessionToken: sessionToken,
          userId: params.token.sub,
          expires: new Date(Date.now() + sessionMaxAge), // 30 days
        });

        if (!createdSession) {
          throw new Error("Failed to create session");
        }

        return sessionToken;
      }
      return defaultEncode(params);
    },
  },
  session: {
    strategy: "database",
    async generateSessionToken() {
      const sessionToken = await generateToken("session", "sessionToken");
      return sessionToken;
    },
    maxAge: sessionMaxAge,
  },
  ...authConfig,
};

// export const {
//   handlers: { GET, POST },
//   auth,
//   signIn,
//   signOut,
//   update,
// } = authOptions;
