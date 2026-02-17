import { resend, fromEmail } from '../config';
import { getBaseTemplate } from '../templates/base';
import { logger } from "@/lib/logger";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  htmlContent: string;
  cc?: string | string[];
  bcc?: string | string[];
}

/**
 * Sends a custom email using the provided options.
 *
 * @param to - The email address(es) to send the email to.
 * @param subject - The subject of the email.
 * @param htmlContent - The HTML content of the email.
 * @param cc - The email address(es) to copy (CC) the email to.
 * @param bcc - The email address(es) to blind copy (BCC) the email to.
 * @returns The result of sending the email.
 */
export const sendCustomEmail = async ({
  to,
  subject,
  htmlContent,
  cc,
  bcc
}: SendEmailOptions) => {
  try {
    const html = getBaseTemplate(htmlContent);
    const mail = await resend.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
      cc,
      bcc
    });
    
    return mail;
  } catch (error) {
    logger.error('Failed to send custom email:', error);
    throw error;
  }
};

