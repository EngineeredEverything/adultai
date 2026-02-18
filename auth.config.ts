import bcrypt from "bcryptjs";
import type { NextAuthOptions } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Github from "next-auth/providers/github";
import Google from "next-auth/providers/google";

import { LoginSchema } from "@/schemas/auth";
import { db } from "./lib/db";
import { logger } from "./lib/logger";

export default {
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET as string,
    }),
    Credentials({
      name: "Credentials",

      credentials: {
        email: { label: "Email", type: "text", placeholder: "jsmith" },
        password: { label: "Password", type: "password" },

      },

      async authorize(credentials) {
        const validatedFields = LoginSchema.safeParse(credentials);

        if (validatedFields.success) {
          const { email, password } = validatedFields.data;

          const user = await db.user.findUnique({
            where: {
              email
            }
          });
          if (!user || !user.password) {
            logger.error("User not found or password not set", {
              email,
            });
            return null
          };

          const passwordsMatch = await bcrypt.compare(password, user.password);
          if (passwordsMatch) {
            return user
          };
        }

        logger.error("Invalid credentials", {
          email: credentials?.email,
        });
        return null;
      },

    }),
  ],
} satisfies NextAuthOptions;
