'use client';

import { createContext, useContext, useState } from 'react';
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

export function AgeVerificationProvider({
  children,
  initialVerified = false,
}: {
  children: React.ReactNode;
  initialVerified?: boolean;
}) {
  const [isVerified, setIsVerified] = useState(initialVerified);
  const pathname = usePathname();

  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  const showGate = !isVerified && !isPublicPath;

  const setVerified = (value: boolean) => {
    setIsVerified(value);
  };

  return (
    <AgeVerificationContext.Provider value={{ isVerified, setVerified }}>
      {children}
      {/* Age gate rendered as overlay — no redirect, no round-trip */}
      {showGate && <AgeVerification callbackUrl={pathname} />}
    </AgeVerificationContext.Provider>
  );
}

export const useAgeVerification = () => useContext(AgeVerificationContext);
