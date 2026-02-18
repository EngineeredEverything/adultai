"use server";

import * as z from "zod";
import { db } from "@/lib/db";
import {
  generateTwoFactorToken,
  generateFourDigitCodeToken,
  getTwoFactorConfirmationByUserId,
  getVerificationOtpByEmail
} from "@/lib/tokens";
import { LoginSchema } from "@/schemas/auth";
import { logger } from "@/lib/logger";
import { sendCodeEmail, sendTwoFactorTokenEmail } from "@/lib/mail";

export const login = async (
  values: z.infer<typeof LoginSchema>,
  callbackUrl?: string | null
) => {
  logger.info("Login function called with values:", values);

  const validatedFields = LoginSchema.safeParse(values);
  logger.info("Validated fields:", validatedFields);

  if (!validatedFields.success) {
    logger.info("Validation failed");
    return { error: validatedFields.error.issues.map(err => `${err.path.join('.')}:${err.message}`).join(", ") };
  }

  const { email, password, code } = validatedFields.data;
  logger.info("Extracted data:", { email, password, code });

  const existingUser = await db.user.findUnique({ where: { email } });
  logger.info("Existing user:", existingUser);

  if (!existingUser || !existingUser.email || !existingUser.password) {
    logger.info("User not found or incomplete data");
    return { error: "Email does not exist!" };
  }

  if (!existingUser.emailVerified) {
    logger.info("Email not verified, generating verification code");
    const verificationCode = await generateFourDigitCodeToken(existingUser.email);
    logger.info("Verification code generated:", verificationCode);

    await sendCodeEmail(verificationCode.email, verificationCode.otp);
    logger.info("Verification code email sent");

    return { emailVerifing: "Confirmation email sent!" };
  }

  // if (existingUser.isTwoFactorEnabled && existingUser.email) {
  //   logger.info("Two-factor authentication enabled");
  //   if (code) {
  //     const twoFactorToken = await getVerificationOtpByEmail(existingUser.email);

  //     if (!twoFactorToken) {
  //       return { error: "Invalid code!" };
  //     }

  //     if (twoFactorToken.otp !== code) {
  //       return { error: "Invalid code!" };
  //     }

  //     const hasExpired = new Date(twoFactorToken.expires) < new Date();

  //     if (hasExpired) {
  //       return { error: "Code expired!" };
  //     }

  //     await db.twoFactorToken.delete({
  //       where: { id: twoFactorToken.id },
  //     });

  //     const existingConfirmation = await getTwoFactorConfirmationByUserId(
  //       existingUser.id
  //     );

  //     if (existingConfirmation) {
  //       await db.twoFactorConfirmation.delete({
  //         where: { id: existingConfirmation.id },
  //       });
  //     }

  //     await db.twoFactorConfirmation.create({
  //       data: {
  //         userId: existingUser.id,
  //       },
  //     });
  //   } else {
  //     const twoFactorToken = await generateTwoFactorToken(existingUser.email);
  //     await sendTwoFactorTokenEmail(twoFactorToken.email, twoFactorToken.token);

  //     return { twoFactor: true };
  //   }
  // }

  if (existingUser) {
    logger.info("Existing user found, checking if admin");

    if (existingUser.email === process.env.ADMIN_EMAIL) {
      logger.info("Admin user detected, updating system flag");

      await db.user.update({
        where: { id: existingUser.id },
        data: {
          system: true
        },
      });
    }
    logger.info("Login successful");

    return { success: "Login successful!" };
  }


};
