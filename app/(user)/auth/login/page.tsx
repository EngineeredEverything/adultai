import type { Metadata } from 'next';
import { LoginForm } from "@/components/auth/login-form";
export const metadata: Metadata = {
  title: {
    template: '%s | AdultAI - AI Image Generation',
    default: 'Login | AdultAI - Access Your AI Image Generation Account',
    absolute: 'Login to AdultAI - Unlock AI Art Creation',
  },
  description:
    'Log in to AdultAI and access your account to create unique, AI-generated images. Explore advanced AI models, customizable parameters, and creative tools to bring your ideas to life.',
  keywords: [
    // Base keywords
    'AI',
    'Image Generation',
    'Art',
    'AdultAI',
    'AI Art',
    'Digital Creation',

    // Specific to login
    'Login',
    'User Authentication',
    'Account Access',
    'Secure Login',
    'AI Platform Login',
    'Digital Art Login',
  ],
};

const LoginPage = () => {
  return ( 
    <LoginForm />
  );
}
 
export default LoginPage;
