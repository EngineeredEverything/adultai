'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { AgeVerification } from './age-verification';
import { usePathname } from 'next/navigation';

type AgeVerificationContextType = {
  isVerified: boolean;
  setVerified: (value: boolean) => void;
};

const AgeVerificationContext = createContext<AgeVerificationContextType>({
  isVerified: false,
  setVerified: () => {},
});

// Pages that don't need the age gate overlay
const PUBLIC_PATHS = ['/companions/demo', '/companions/showcase', '/companions/landing'];

function checkCookie(): boolean {
  if (typeof document === 'undefined') return false;
  return document.cookie.split(';').some(c => c.trim().startsWith('age_verified='));
}

export function AgeVerificationProvider({
  children,
  initialVerified = false,
}: {
  children: React.ReactNode;
  initialVerified?: boolean;
}) {
  // Start with initialVerified (from SSR cookie check) OR check client cookie
  const [isVerified, setIsVerified] = useState(initialVerified);
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    // On mount, check client cookie in case SSR didn't have it
    if (!isVerified) {
      setIsVerified(checkCookie());
    }
    setMounted(true);
  }, []);

  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  // Don't show gate until mounted (avoids flash on already-verified users)
  const showGate = mounted && !isVerified && !isPublicPath;

  const setVerified = (value: boolean) => {
    setIsVerified(value);
  };

  return (
    <AgeVerificationContext.Provider value={{ isVerified, setVerified }}>
      {children}
      {showGate && <AgeVerification callbackUrl={pathname} />}
    </AgeVerificationContext.Provider>
  );
}

export const useAgeVerification = () => useContext(AgeVerificationContext);
