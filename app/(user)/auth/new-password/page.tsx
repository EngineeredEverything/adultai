import type { Metadata } from 'next';
import { NewPasswordForm } from "@/components/auth/new-password-form";
export const metadata: Metadata = {
  title: {
    template: '%s | AdultAI - Account Security',
    default: 'New Password | AdultAI - Secure Your Account',
    absolute: 'AdultAI - Reset Your Password',
  },
  description:
    "Securely reset or create a new password for your AdultAI account. Ensure your account's safety with our easy-to-use password reset interface. Protect your access to advanced AI image generation tools.",
  keywords: [
    // Base keywords
    'AdultAI',
    'Password Reset',
    'Account Security',
    'AI Image Generation',
    'Secure Login',

    // Specific features
    'New Password',
    'Password Recovery',
    'User Authentication',
    'Account Management',
  ],
};

const NewPasswordPage = () => {
  return ( 
    <NewPasswordForm />
   );
}
 
export default NewPasswordPage;
