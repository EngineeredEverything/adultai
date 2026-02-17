import { resend, fromEmail, domain } from "../config";
import {
  compileTemplate,
  getBaseTemplate,
  loadTemplate,
} from "../templates/base";
import { logger } from "@/lib/logger";

/** * Sends a two-factor authentication (2FA) token email to the specified email address.
 *
 * @param email - The email address to send the 2FA token email to.
 * @param token - The 2FA token to include in the email.
 * @returns A promise that resolves to the result of sending the email.
 */
export const sendTwoFactorTokenEmail = async (email: string, token: string) => {
  try {
    const template = compileTemplate("auth/two-factor.html", { token });

    const html = getBaseTemplate(template);

    const mail = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Your 2FA Code for adultai",
      html,
    });

    return mail;
  } catch (error) {
    logger.error("Failed to send 2FA email:", error);
    throw error;
  }
};

/**
 * Sends a password reset email to the specified email address.
 *
 * @param email - The email address to send the password reset email to.
 * @param token - The password reset token to include in the email.
 * @returns A promise that resolves to the email sent response.
 */
export const sendPasswordResetEmail = async (email: string, token: string) => {
  try {
    const resetLink = `${domain}/auth/new-password?token=${token}`;
    const template = compileTemplate("auth/password-reset.html", { token });

    const html = getBaseTemplate(template);

    const mail = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Reset your adultai password",
      html,
    });

    return mail;
  } catch (error) {
    logger.error("Failed to send password reset email:", error);
    throw error;
  }
};

/**
 * Sends a verification email to the specified email address.
 *
 * @param email - The email address to send the verification email to.
 * @param token - The verification token to include in the email.
 * @returns A promise that resolves to the result of sending the email.
 */
export const sendVerificationEmail = async (email: string, token: string) => {
  try {
    const confirmLink = `${domain}/auth/new-verification?token=${token}`;
    const template = compileTemplate("auth/verification.html", { confirmLink });

    const html = getBaseTemplate(template);

    const mail = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Verify your email for adultai",
      html,
    });

    return mail;
  } catch (error) {
    logger.error("Failed to send verification email:", error);
    throw error;
  }
};

/**
 * Sends a verification email to the specified email address.
 *
 * @param email - The email address to send the verification email to.
 * @param token - The verification token to include in the email.
 * @returns A promise that resolves to the result of sending the email.
 */
export const sendCodeEmail = async (email: string, code: string) => {
  try {
    const template = compileTemplate("auth/code.html", { code });

    const html = getBaseTemplate(template);

    const mail = await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: "Password Reset Code for adultai",
      html,
    });

    return mail;
  } catch (error) {
    logger.error("Failed to send verification email:", error);
    throw error;
  }
};
