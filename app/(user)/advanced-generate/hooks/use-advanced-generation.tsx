"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { logger } from "@/lib/logger";
import { checkImageStatus, searchImages } from "@/actions/images/info";
import { createAdvancedGeneratedImage } from "@/actions/images/create";
import type { GenerationOptions } from "../advanced-generation-utils";
import { validateGenerationOptions } from "../advanced-generation-utils";
import type { SubscriptionStatus } from "../../gallery/components/GenerationForm/subscription-utils";
import { toast } from "sonner";

interface UseAdvancedGenerationProps {
  subscriptionStatus?: SubscriptionStatus;
  onPremiumRequired: (feature: string, requiredPlan: string) => void;
}

interface GenerationState {
  isGenerating: boolean;
  generatedImages: string[];
  pendingTaskIds: string[];
  pendingCount: number;
  progress: number;
  error: string | null;
  retryCount: number;
  eta: number | null;
  status: "idle" | "queued" | "processing" | "completed" | "failed";
}

const INITIAL_STATE: GenerationState = {
  isGenerating: false,
  generatedImages: [],
  pendingTaskIds: [],
  pendingCount: 0,
  progress: 0,
  error: null,
  retryCount: 0,
  eta: null,
  status: "idle",
};

const MAX_RETRY_ATTEMPTS = 3;
const POLL_INTERVAL = 2000;
const MAX_POLL_DURATION = 300000; // 5 minutes

export function useAdvancedGeneration({
  subscriptionStatus,
  onPremiumRequired,
}: UseAdvancedGenerationProps) {
  const [state, setState] = useState<GenerationState>(INITIAL_STATE);
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const pollStartTime = useRef<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  logger.debug("useAdvancedGeneration initialized", { subscriptionStatus });

  const updateState = useCallback((updates: Partial<GenerationState>) => {
    setState((prev) => {
      const newState = { ...prev, ...updates };
      logger.debug("State updated", { from: prev, to: newState, updates });
      return newState;
    });
  }, []);

  const resetState = useCallback(() => {
    logger.info("Resetting generation state");
    setState(INITIAL_STATE);
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const handleError = useCallback(
    (error: unknown, context: string) => {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error(`Error in ${context}:`, error, { context, errorMessage });

      updateState({
        error: errorMessage,
        isGenerating: false,
        status: "failed",
        progress: 0,
      });

      toast.error("Generation Error", {
        description: errorMessage,
        action: {
          label: "Retry",
          onClick: () => updateState({ error: null, status: "idle" }),
        },
      });
    },
    [updateState]
  );

  const pollPendingTasks = useCallback(async () => {
    if (state.pendingTaskIds.length === 0) {
      logger.debug("No pending tasks to poll");
      return;
    }

    // Check for timeout
    const elapsed = Date.now() - pollStartTime.current;
    if (elapsed > MAX_POLL_DURATION) {
      logger.warn("Polling timeout reached", {
        elapsed,
        maxDuration: MAX_POLL_DURATION,
      });
      toast.error("Generation Timeout", {
        description:
          "Generation is taking longer than expected. Please try again.",
      });
      updateState({
        isGenerating: false,
        pendingTaskIds: [],
        error: "Generation timeout",
        status: "failed",
        progress: 0,
      });
      return;
    }

    try {
      logger.debug("Polling pending tasks", {
        taskIds: state.pendingTaskIds,
        elapsed,
      });

      const completedTasks: string[] = [];
      const failedTasks: string[] = [];
      let newImages: string[] = [];
      let maxProgress = 0;
      let currentEta: number | null = null;
      let currentStatus: GenerationState["status"] = "processing";

      for (const taskId of state.pendingTaskIds) {
        try {
          const result = await checkImageStatus({ taskId });

          if ("error" in result) {
            logger.warn(`Task ${taskId} check failed:`, result.error);
            if (state.retryCount < MAX_RETRY_ATTEMPTS) {
              updateState({ retryCount: state.retryCount + 1 });
              continue;
            } else {
              failedTasks.push(taskId);
              continue;
            }
          }

          logger.debug(`Task ${taskId} status:`, {
            status: result.status,
            progress: result.progress,
            eta: result.eta,
          });

          // Update progress and ETA
          if (result.progress !== undefined) {
            maxProgress = Math.max(maxProgress, result.progress);
          }

          if (result.eta) {
            currentEta = result.eta;
          }

          if (result.status === "completed") {
            completedTasks.push(taskId);
            currentStatus = "completed";
            maxProgress = 100;

            if (result.images) {
              try {
                const refreshedImages = await searchImages({
                  data: {
                    ids: result.images.map((d) => d.id),
                    limit: { start: 0, end: result.images.length },
                    images: {
                      comments: { count: true },
                      votes: {count: true },
                    },
                  },
                });

                if (!("error" in refreshedImages)) {
                  const imageUrls = refreshedImages.images
                    .map((image) => image.image.cdnUrl)
                    .filter(Boolean) as string[];

                  newImages = [...newImages, ...imageUrls];
                  logger.info(`Task ${taskId} completed successfully`, {
                    imageCount: imageUrls.length,
                  });
                } else {
                  logger.error(
                    `Failed to fetch refreshed images for task ${taskId}:`,
                    refreshedImages.error
                  );
                }
              } catch (error) {
                logger.error(
                  `Error fetching images for task ${taskId}:`,
                  error
                );
              }
            }
          } else if (result.status === "failed") {
            failedTasks.push(taskId);
            currentStatus = "failed";
            logger.warn(`Task ${taskId} failed`);
          } else if (result.status === "processing") {
            currentStatus = "processing";
          } else if (result.status === "queued") {
            currentStatus = "queued";
            maxProgress = Math.max(maxProgress, 5); // Minimum progress for queued
          }
        } catch (error) {
          logger.error(`Error checking task ${taskId}:`, error);
          if (state.retryCount < MAX_RETRY_ATTEMPTS) {
            updateState({ retryCount: state.retryCount + 1 });
          } else {
            failedTasks.push(taskId);
          }
        }
      }

      // Update state based on results
      const remainingTasks = state.pendingTaskIds.filter(
        (id) => !completedTasks.includes(id) && !failedTasks.includes(id)
      );

      const updates: Partial<GenerationState> = {
        progress: maxProgress,
        eta: currentEta,
        status: currentStatus,
        retryCount: 0,
      };

      if (completedTasks.length > 0) {
        updates.generatedImages = [...state.generatedImages, ...newImages];
        updates.pendingTaskIds = remainingTasks;

        toast.success("Images Ready", {
          description: `${completedTasks.length} image${
            completedTasks.length > 1 ? "s" : ""
          } generated successfully!`,
        });
      }

      if (failedTasks.length > 0) {
        updates.pendingTaskIds = remainingTasks;
        updates.error = `${failedTasks.length} generation${
          failedTasks.length > 1 ? "s" : ""
        } failed`;
        updates.status = "failed";

        toast.error("Generation Failed", {
          description: `${failedTasks.length} image${
            failedTasks.length > 1 ? "s" : ""
          } failed to generate. Please try again.`,
        });
      }

      // If all tasks are done, stop generating
      if (remainingTasks.length === 0) {
        updates.isGenerating = false;
        updates.pendingCount = 0;
        if (currentStatus === "completed") {
          updates.progress = 100;
        }
        logger.info("All generation tasks completed");
      }

      updateState(updates);
    } catch (error) {
      handleError(error, "pollPendingTasks");
    }
  }, [
    state.pendingTaskIds,
    state.retryCount,
    state.generatedImages,
    updateState,
    handleError,
  ]);

  // Polling effect
  useEffect(() => {
    if (state.pendingTaskIds.length > 0 && state.isGenerating) {
      if (!pollRef.current) {
        pollStartTime.current = Date.now();
        pollRef.current = setInterval(pollPendingTasks, POLL_INTERVAL);
        logger.debug("Started polling for pending tasks", {
          interval: POLL_INTERVAL,
          taskCount: state.pendingTaskIds.length,
        });
      }
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        logger.debug("Stopped polling for pending tasks");
      }
    }

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [state.pendingTaskIds, state.isGenerating, pollPendingTasks]);

  const generateImages = useCallback(
    async (options: GenerationOptions) => {
      logger.info("Starting image generation", { options });

      // Reset any previous errors
      updateState({
        error: null,
        retryCount: 0,
        progress: 0,
        status: "idle",
        eta: null,
      });

      if (!subscriptionStatus) {
        logger.warn("No subscription status available");
        onPremiumRequired("image generation", "basic");
        return;
      }

      // Validate options
      const validation = validateGenerationOptions(options, subscriptionStatus);
      if (!validation.isValid) {
        const errorMessage = validation.errors[0];
        logger.error("Generation options validation failed", {
          errors: validation.errors,
          options,
        });

        toast.error("Invalid Generation Options", {
          description: errorMessage,
        });
        return;
      }

      // Create abort controller for this generation
      abortControllerRef.current = new AbortController();

      updateState({
        isGenerating: true,
        generatedImages: [],
        progress: 5, // Initial progress
        error: null,
        status: "queued",
      });

      // Show initial toast
      const loadingToast = toast.loading("Preparing Generation", {
        description: "Setting up your image generation request...",
      });

      try {
        const sanitizedOptions = {
          ...options,
          seed: options.seed || undefined,
          loraModel:
            options.loraModel === "none" ? undefined : options.loraModel,
          loraStrength:
            options.loraModel === "none" ? undefined : options.loraStrength,
          enhanceStyle:
            options.enhanceStyle === "none" ? undefined : options.enhanceStyle,
        };

        logger.debug("Sending generation request", { sanitizedOptions });

        const results = await createAdvancedGeneratedImage({
          options: sanitizedOptions,
        });

        // Dismiss loading toast
        toast.dismiss(loadingToast);

        if ("error" in results) {
          throw new Error(results.error);
        }

        logger.info("Generation request successful", {
          status: results.status,
          hasTaskId: !!results.taskId,
          hasImages: !!results.images,
        });

        if (results.status === "processing" && results.taskId) {
          updateState({
            pendingTaskIds: [results.taskId],
            pendingCount: options.count,
            progress: 10, // Initial processing progress
            status: "processing",
            eta: results.eta || null,
          });

          const etaMessage = results.eta
            ? `Your images will be ready in about ${Math.ceil(
                results.eta
              )} seconds`
            : "Your images are being generated";

          toast.success("Generation Started", {
            description: etaMessage,
            duration: 5000,
          });
        } else if (results.images) {
          const imageUrls = results.images
            .map((image) => image.image.cdnUrl)
            .filter(Boolean) as string[];

          updateState({
            generatedImages: imageUrls,
            isGenerating: false,
            progress: 100,
            status: "completed",
          });

          logger.info("Images generated immediately", {
            imageCount: imageUrls.length,
          });

          toast.success("Images Generated", {
            description: `${imageUrls.length} image${
              imageUrls.length > 1 ? "s" : ""
            } generated successfully!`,
          });
        }
      } catch (error: any) {
        toast.dismiss(loadingToast);
        handleError(error, "generateImages");
      }
    },
    [subscriptionStatus, onPremiumRequired, updateState, handleError]
  );

  const clearImages = useCallback(() => {
    logger.info("Clearing generated images");
    updateState({
      generatedImages: [],
      error: null,
      progress: 0,
      status: "idle",
    });
    toast.success("Images Cleared", {
      description: "Generated images have been cleared",
    });
  }, [updateState]);

  const retryGeneration = useCallback(() => {
    logger.info("Retrying generation");
    updateState({
      error: null,
      retryCount: 0,
      isGenerating: false,
      pendingTaskIds: [],
      pendingCount: 0,
      progress: 0,
      status: "idle",
    });
  }, [updateState]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      logger.debug("useAdvancedGeneration cleanup completed");
    };
  }, []);

  return {
    isGenerating: state.isGenerating,
    generatedImages: state.generatedImages,
    pendingCount: state.pendingCount,
    progress: state.progress,
    eta: state.eta,
    status: state.status,
    error: state.error,
    generateImages,
    clearImages,
    retryGeneration,
    resetState,
  };
}
