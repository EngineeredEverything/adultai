import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);
export const domain = process.env.APP_URL as string;
export const fromEmail = `support@adultai.com`;
