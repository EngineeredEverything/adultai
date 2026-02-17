import type { Metadata } from 'next';
import { DEFAULT_AUTH_REDIRECT } from "@/routes";
import { redirect } from "next/navigation";
export const metadata: Metadata = {
  title: {
    template: '%s | AdultAI - AI Image Generation',
    default: 'AdultAI - A Safer Way to Adult',
    absolute: 'AdultAI - Authentication Redirect',
  },
  description:
    "AdultAI's authentication redirect ensures secure and seamless access to the platform. Experience advanced AI image generation with secure user authentication.",
  keywords: [
    // Base keywords
    'AI',
    'Image Generation',
    'Art',
    'AdultAI',
    'AI Art',
    'Digital Creation',

    // Specific features
    'Authentication',
    'User Login',
    'Secure Access',
    'Redirect',
    'Authentication Flow',
  ],
};


export default function Auth() {
  redirect(DEFAULT_AUTH_REDIRECT);
}

