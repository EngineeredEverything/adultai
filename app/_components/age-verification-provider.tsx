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
  initialShowGate = false,
}: {
  children: React.ReactNode;
  initialVerified?: boolean;
  // Server-computed: show gate immediately (pre-hydration) based on SSR cookie check
  initialShowGate?: boolean;
}) {
  const [isVerified, setIsVerified] = useState(initialVerified);
  const pathname = usePathname();

  const isPublicPath = PUBLIC_PATHS.some(p => pathname.startsWith(p));
  // After hydration: re-evaluate based on client state
  // Before hydration: use server-computed initialShowGate to avoid flash
  const showGate = !isVerified && !isPublicPath;

  const setVerified = (value: boolean) => {
    setIsVerified(value);
  };

  return (
    <AgeVerificationContext.Provider value={{ isVerified, setVerified }}>
      {children}
      {/* Age gate rendered as overlay — no redirect, no round-trip.
          initialShowGate ensures it's rendered in the SSR HTML so it appears
          before JS hydration (no blank screen flash on first visit). */}
      {(showGate || initialShowGate) && !isVerified && <AgeVerification callbackUrl={pathname} />}
    </AgeVerificationContext.Provider>
  );
}

export const useAgeVerification = () => useContext(AgeVerificationContext);
