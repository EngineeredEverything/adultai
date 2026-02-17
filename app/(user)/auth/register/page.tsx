import { RegisterForm } from "@/components/auth/register-form";

import type { Metadata } from 'next';
export const metadata: Metadata = {
  title: {
    template: '%s | AdultAI - AI Image Generation',
    default: 'Register | AdultAI - AI Image Generation Platform',
    absolute: 'Register to AdultAI - Create Unique AI-Generated Images',
  },
  description:
    'Join AdultAI and unlock the power of AI image generation. Register now to create a personalized account and start generating unique, high-quality AI art with customizable parameters and styles.',
  keywords: [
    // Base keywords
    'AI',
    'Image Generation',
    'Art',
    'AdultAI',
    'AI Art',
    'Digital Creation',

    // Specific to registration
    'Register',
    'Sign Up',
    'Create Account',
    'User Registration',
    'AI Platform',
    'Digital Art Creation',
  ],
};

const RegisterPage = () => {
  return ( 
    <RegisterForm />
  );
}
 
export default RegisterPage;