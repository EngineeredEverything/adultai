import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';

export const useSidebar = () => {
  const [expanded, setExpanded] = useState(true);
  const [isLoginOpen, setIsLoginOpen] = useState(false);

  // Set initial state based on screen size
  useEffect(() => {
    const handleResize = () => {
      setExpanded(window.innerWidth >= 768);
    };

    // Set initial state
    handleResize();

    // Add event listener
    window.addEventListener("resize", handleResize);

    // Cleanup
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Toggle sidebar function
  const toggleSidebar = () => {
    logger.info(
      "Toggle sidebar clicked. Current state:",
      expanded,
      "New state:",
      !expanded
    );
    setExpanded(!expanded);
  };

  const handleModelClose = () => {
    logger.debug("Closing login modal");
    if (isLoginOpen) {
      logger.debug("Login modal is open, closing it");
      setIsLoginOpen(false);
    }
  };

  return {
    expanded,
    isLoginOpen,
    setIsLoginOpen,
    toggleSidebar,
    handleModelClose,
  };
};
