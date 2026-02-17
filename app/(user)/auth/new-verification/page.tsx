import type { Metadata } from 'next';
import { NewVerificationForm } from "@/components/auth/new-verification-form";
export const metadata: Metadata = {
  title: {
    template: '%s | AdultAI - Account Verification',
    default: 'Account Verification | AdultAI',
    absolute: 'AdultAI - Secure Account Verification',
  },
  description:
    "Verify your account securely with AdultAI's advanced verification system. Ensure your account is active and protected with our reliable verification process.",
  keywords: [
    // Base keywords
    'Account Verification',
    'Email Verification',
    'User Authentication',
    'AdultAI',
    'Secure Verification',
    'Account Security',

    // Specific features
    'Verification Form',
    'User Account Activation',
    'Next.js Verification',
  ],
};

const NewVerificationPage = () => {
  return ( 
    <NewVerificationForm />
   );
}
 
export default NewVerificationPage;
