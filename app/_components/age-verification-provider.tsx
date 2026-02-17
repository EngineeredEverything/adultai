'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type AgeVerificationContextType = {
  isVerified: boolean;
  setVerified: (value: boolean) => void;
};

const AgeVerificationContext = createContext<AgeVerificationContextType>({
  isVerified: false,
  setVerified: () => {},
});

export function AgeVerificationProvider({
  children,
  initialVerified = false,
}: {
  children: React.ReactNode;
  initialVerified?: boolean;
}) {
  const [isVerified, setIsVerified] = useState(initialVerified);

  const setVerified = (value: boolean) => {
    setIsVerified(value);
  };

  return (
    <AgeVerificationContext.Provider value={{ isVerified, setVerified }}>
      {children}
    </AgeVerificationContext.Provider>
  );
}

export const useAgeVerification = () => useContext(AgeVerificationContext);
