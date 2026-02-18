"use client";

import { useState } from "react";
import type { Feature, PlanTier } from "../subscription-utils";

interface PremiumModalState {
  isOpen: boolean;
  feature: Feature | null;
  requiredPlan: PlanTier | null;
}

export function usePremiumModal() {
  const [modalState, setModalState] = useState<PremiumModalState>({
    isOpen: false,
    feature: null,
    requiredPlan: null,
  });

  const openModal = (feature: Feature, requiredPlan: PlanTier) => {
    setModalState({
      isOpen: true,
      feature,
      requiredPlan,
    });
  };

  const closeModal = () => {
    setModalState({
      isOpen: false,
      feature: null,
      requiredPlan: null,
    });
  };

  return {
    ...modalState,
    openModal,
    closeModal,
  };
}
