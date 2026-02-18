"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useScroll } from "framer-motion";

interface ScrollContextProps {
  isScrolled: boolean;
}

const ScrollContext = createContext<ScrollContextProps | undefined>(undefined);

export function ScrollProvider({ children }: { children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: containerRef });
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const unsubscribe = scrollY.onChange((y) => {
      setIsScrolled(y > 80);
    });
    return () => unsubscribe();
  }, [scrollY]);

  return (
    <ScrollContext.Provider value={{ isScrolled }}>
      <div
        ref={containerRef}
        className="w-full overflow-y-auto relative z-20 h-[calc(100vh-64px)]"
      >
        <main>{children}</main>
      </div>
    </ScrollContext.Provider>
  );
}

export function useIsScrolled() {
  const context = useContext(ScrollContext);
  if (!context) {
    throw new Error("useIsScrolled must be used within a ScrollProvider");
  }
  return context;
}
