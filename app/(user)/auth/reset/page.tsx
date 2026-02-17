import { ResetForm } from "@/components/auth/reset-form";
import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: {
    template: '%s | AdultAI - Reset Password',
    default: 'Reset Password | AdultAI',
    absolute: 'Reset Password | AdultAI - Secure Account Recovery',
  },
  description:
    'Reset your AdultAI account password securely. Follow the simple steps to regain access to your account and continue using our advanced AI image generation platform.',
  keywords: [
    // Base keywords
    'Reset Password',
    'Account Recovery',
    'AdultAI',
    'AI Image Generation',
    'Secure Login',

    // Specific features
    'Password Reset Form',
    'Account Security',
    'Authentication',
    'Digital Security',
    'AI Platform',
  ],
};

const ResetPage = () => {
  return ( 
    <ResetForm />
  );
}
 
export default ResetPage;