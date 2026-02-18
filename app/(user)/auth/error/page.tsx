import { ErrorCard } from "@/components/auth/error-card";
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: {
    template: '%s | AdultAI - AI Image Generation',
    default: 'Authentication Error | AdultAI',
    absolute: 'Authentication Error | AdultAI - AI Image Generation Platform',
  },
  description:
    'Encountered an authentication error on AdultAI. Our platform ensures secure and seamless access to advanced AI image generation tools. Please try again or contact support for assistance.',
  keywords: [
    // Base keywords
    'AI',
    'Image Generation',
    'Art',
    'AdultAI',
    'AI Art',
    'Digital Creation',

    // Specific to this page
    'Authentication Error',
    'Login Issue',
    'Access Problem',
    'Error Handling',
    'Support',
  ],
};

const AuthErrorPage = () => {
  return <ErrorCard />;
};
export default AuthErrorPage;
