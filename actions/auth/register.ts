"use server";

import * as z from "zod";
import bcrypt from "bcryptjs";

import { db } from "@/lib/db";
import { RegisterSchema } from "@/schemas/auth";
import { sendVerificationEmail } from "@/lib/mail";
import { generateVerificationToken } from "@/lib/tokens";
import { logger } from "@/lib/logger";

export const register = async (values: z.infer<typeof RegisterSchema>) => {
  const validatedFields = RegisterSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: validatedFields.error.issues.map(err => `${err.path.join('.')}:${err.message}`).join(", ") };
  }

  const { email, password, name } = validatedFields.data;



  const hashedPassword = await bcrypt.hash(password, 10);

  const existingUser = await db.user.findUnique({ where: { email } });

  if (existingUser) {
    return { error: "Email already in use!" };
  }


  const verificationToken = await generateVerificationToken(email);
  logger.info(`Generated verification token for ${email}: ${verificationToken.token}`);
  const response = await sendVerificationEmail(verificationToken.email, verificationToken.token);
  if (response.error) {
    logger.error(`Failed to send verification email to ${email}: ${response.error}`);
    logger.debug(response.error)
    console.log(response.error)
    return { error: "Failed to send verification email. Please try again later." };
  }

  await db.user.create({
    data: {
      email: email,
      password: hashedPassword,
      name: name,
      system: email === process.env.ADMIN_EMAIL,
      emailVerified: undefined,
    },
  });

  return { success: "Confirmation email sent!" };
};
