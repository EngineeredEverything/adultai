"use server";

import * as z from "zod";
import bcrypt from "bcryptjs";

import { NewPasswordSchema } from "@/schemas/auth";
import { getUserByEmail } from "@/utils/user";
import { db } from "@/lib/db";
import { getPasswordResetOTPByOtp, getPasswordResetTokenByToken } from "@/lib/tokens";

export const newPassword = async (
  values: z.infer<typeof NewPasswordSchema>,
  type: "otp" | "token",
  token?: string | null
) => {
  if (!token) {
    return { error: "Missing token!" };
  }

  const validatedFields = NewPasswordSchema.safeParse(values);

  if (!validatedFields.success) {
    return { error: validatedFields.error.issues.map(err=>`${err.path.join('.')}:${err.message}`).join(", ") };
  }

  const { password } = validatedFields.data;
  let existingToken;
  if (type === "otp") {
    existingToken = await getPasswordResetOTPByOtp(token);
  } else {
    existingToken = await getPasswordResetTokenByToken(token);
  }

  if (!existingToken) {
    return { error: "Invalid token!" };
  }

  const hasExpired = new Date(existingToken.expires) < new Date();

  if (hasExpired) {
    return { error: "Token has expired!" };
  }

  const existingUser = await getUserByEmail(existingToken.email);

  if (!existingUser) {
    return { error: "Email does not exist!" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await db.user.update({
    where: { id: existingUser.id },
    data: { password: hashedPassword },
  });
  if (type === "otp") {
    await db.oTPConfirmation.delete({
      where: { id: existingToken.id },
    });
  } else {
    await db.passwordResetToken.delete({
      where: { id: existingToken.id },
    });
  }

  return { success: "Password updated!" };
};
