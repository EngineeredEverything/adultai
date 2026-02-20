"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Zap, Info, AlertCircle, CheckCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import type { SubscriptionStatus } from "../../gallery/components/GenerationForm/subscription-utils";
import {
  DEFAULT_OPTIONS,
  AVAILABLE_MODELS,
  AVAILABLE_SAMPLERS,
  AVAILABLE_SCHEDULERS,
  AVAILABLE_LORAS,
  AVAILABLE_DIMENSIONS,
  getAdvancedFeatureAccess,
  getMaxImageCount,
  calculateGenerationCost,
  validateGenerationOptions,
  type GenerationOptions,
} from "../advanced-generation-utils";
import { ENHANCE_STYLES } from "@/data/ENHANCE_STYLES";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface AdvancedGenerationFormProps {
  subscriptionStatus?: SubscriptionStatus;
  onGenerate: (options: GenerationOptions) => void;
  onPremiumRequired: (feature: string, requiredPlan: string) => void;
  isGenerating: boolean;
}

interface FormValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export function AdvancedGenerationForm({
  subscriptionStatus,
  onGenerate,
  onPremiumRequired,
  isGenerating,
}: AdvancedGenerationFormProps) {
  const searchParams = useSearchParams();
  const [options, setOptions] = useState<GenerationOptions>(DEFAULT_OPTIONS);
  const [validation, setValidation] = useState<FormValidation>({
    isValid: true,
    errors: [],
    warnings: [],
  });
  const [isFormDirty, setIsFormDirty] = useState(false);

  const featureAccess = getAdvancedFeatureAccess(subscriptionStatus);
  const maxImageCount = getMaxImageCount(subscriptionStatus);
  const estimatedCost = calculateGenerationCost(options);

  logger.debug("AdvancedGenerationForm rendered", {
    isGenerating,
    hasSubscription: !!subscriptionStatus,
    estimatedCost,
  });

  // Validate form whenever options change
  const validateForm = useCallback(
    (currentOptions: GenerationOptions): FormValidation => {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Basic validation
      if (!currentOptions.prompt.trim()) {
        errors.push("Prompt is required");
      }

      if (currentOptions.prompt.length > 1000) {
        warnings.push("Very long prompts may not work as expected");
      }

      // Subscription validation
      const subscriptionValidation = validateGenerationOptions(
        currentOptions,
        subscriptionStatus
      );
      if (!subscriptionValidation.isValid) {
        errors.push(...subscriptionValidation.errors);
      }

      // Technical validation
      if (currentOptions.steps < 10) {
        warnings.push("Very low step count may produce poor quality images");
      }

      if (currentOptions.cfg > 15) {
        warnings.push("Very high CFG scale may produce over-saturated images");
      }

      if (currentOptions.width * currentOptions.height > 2048 * 2048) {
        warnings.push(
          "Very high resolution may take significantly longer to generate"
        );
      }

      const result = {
        isValid: errors.length === 0,
        errors,
        warnings,
      };

      logger.debug("Form validation result", result);
      return result;
    },
    [subscriptionStatus]
  );

  // Initialize from URL params
  useEffect(() => {
    if (!searchParams) return;

    logger.info("Initializing form from URL parameters");
    const urlOptions: Partial<GenerationOptions> = {};

    // Parse all possible URL parameters
    const paramKeys: (keyof GenerationOptions)[] = [
      "prompt",
      "negativePrompt",
      "seed",
      "modelId",
      "steps",
      "cfg",
      "sampler",
      "width",
      "height",
      "loraModel",
      "loraStrength",
      "enhanceStyle",
      "count",
      "scheduler",
      "clipSkip",
    ];

    paramKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value !== null) {
        if (typeof DEFAULT_OPTIONS[key] === "number") {
          urlOptions[key] = Number(value) as any;
        } else {
          urlOptions[key] = value as any;
        }
      }
    });

    if (Object.keys(urlOptions).length > 0) {
      logger.debug("URL parameters found", urlOptions);
      setOptions((prev) => ({ ...prev, ...urlOptions }));
      setIsFormDirty(true);
    }
  }, [searchParams]);

  // Validate form whenever options change
  useEffect(() => {
    const newValidation = validateForm(options);
    setValidation(newValidation);
  }, [options, validateForm]);

  const handleOptionChange = <K extends keyof GenerationOptions>(
    key: K,
    value: GenerationOptions[K],
    requiredFeature?: string,
    requiredPlan?: string
  ) => {
    logger.debug("Option change requested", {
      key,
      value,
      requiredFeature,
      requiredPlan,
    });

    // Check if feature requires premium access
    if (requiredFeature && requiredPlan) {
      const featureAccessValue =
        featureAccess[requiredFeature as keyof typeof featureAccess];
      const hasAccess =
        typeof featureAccessValue === "object"
          ? featureAccessValue.hasAccess
          : featureAccessValue;

      if (!hasAccess) {
        logger.warn("Premium feature access denied", {
          feature: requiredFeature,
          plan: requiredPlan,
        });
        onPremiumRequired(requiredFeature, requiredPlan);

        toast.error("Premium Feature", {
          description: `${requiredFeature} requires ${requiredPlan} plan`,
        });
        return;
      }
    }

    setOptions((prev) => {
      const newOptions = { ...prev, [key]: value };
      logger.debug("Options updated", {
        key,
        oldValue: prev[key],
        newValue: value,
      });
      return newOptions;
    });

    setIsFormDirty(true);

    // Show success toast for certain changes
    if (key === "modelId") {
      const model = AVAILABLE_MODELS.find((m) => m.id === value);
      if (model) {
        toast.success("Model Changed", {
          description: `Switched to ${model.name}`,
        });
      }
    }
  };

  const handleSubmit = () => {
    logger.info("Form submission requested", { options, validation });

    if (!validation.isValid) {
      logger.warn(
        "Form submission blocked due to validation errors",
        validation.errors
      );
      toast.error("Validation Error", {
        description: validation.errors[0],
      });
      return;
    }

    if (validation.warnings.length > 0) {
      logger.info("Form has warnings", validation.warnings);
      toast.warning("Generation Warning", {
        description: validation.warnings[0],
      });
    }

    onGenerate(options);
    setIsFormDirty(false);
  };

  const resetForm = () => {
    logger.info("Form reset requested");
    setOptions(DEFAULT_OPTIONS);
    setIsFormDirty(false);
    toast.success("Form Reset", {
      description: "All settings have been reset to defaults",
    });
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Advanced Generation</h2>
            {isFormDirty && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                Reset Form
              </Button>
            )}
          </div>
          <p className="text-muted-foreground">
            Fine-tune your image generation with advanced controls
          </p>
        </div>

        {/* Validation Alerts */}
        {validation.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {validation.errors.map((error, index) => (
                  <div key={index}>• {error}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {validation.warnings.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-1">
                {validation.warnings.map((warning, index) => (
                  <div key={index}>• {warning}</div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Cost Estimation */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Estimated Cost</p>
                <p className="text-2xl font-bold text-primary">
                  {estimatedCost} TEMPT
                </p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">
                  Images: {options.count}
                </p>
                <p className="text-sm text-muted-foreground">
                  Resolution: {options.width}×{options.height}
                </p>
                {validation.isValid && (
                  <div className="flex items-center text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Ready to generate
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
            <TabsTrigger value="style">Style & Effects</TabsTrigger>
          </TabsList>

          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-6">
            {/* Prompts */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Prompt *
                </label>
                <Textarea
                  value={options.prompt}
                  onChange={(e) => handleOptionChange("prompt", e.target.value)}
                  className="min-h-[100px]"
                  placeholder="Describe what you want to generate..."
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>{options.prompt.length}/1000 characters</span>
                  {options.prompt.length > 800 && (
                    <span className="text-amber-600">Approaching limit</span>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Negative Prompt</label>
                  {!featureAccess.negativePrompts.hasAccess && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      {featureAccess.negativePrompts.requiredPlan}
                    </Badge>
                  )}
                </div>
                <Textarea
                  value={options.negativePrompt}
                  onChange={(e) =>
                    handleOptionChange(
                      "negativePrompt",
                      e.target.value,
                      "negativePrompts",
                      featureAccess.negativePrompts.requiredPlan
                    )
                  }
                  className="min-h-[80px]"
                  disabled={!featureAccess.negativePrompts.hasAccess}
                  placeholder={
                    featureAccess.negativePrompts.hasAccess
                      ? "What you don't want to see..."
                      : "Upgrade to use negative prompts"
                  }
                />
              </div>
            </div>

            {/* Model Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <Select
                value={options.modelId}
                onValueChange={(value) => {
                  const model = AVAILABLE_MODELS.find((m) => m.id === value);
                  if (model?.premium) {
                    handleOptionChange(
                      "modelId",
                      value,
                      "premiumModels",
                      featureAccess.premiumModels.requiredPlan
                    );
                  } else {
                    handleOptionChange("modelId", value);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_MODELS.map((model) => (
                    <SelectItem key={model.id} value={model.id}>
                      <div className="flex items-center gap-2">
                        <span>{model.name}</span>
                        {model.premium && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Pro
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {
                  AVAILABLE_MODELS.find((m) => m.id === options.modelId)
                    ?.description
                }
              </p>
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Dimensions
              </label>
              <Select
                value={`${options.width}x${options.height}`}
                onValueChange={(value) => {
                  const [width, height] = value.split("x").map(Number);
                  const dimension = AVAILABLE_DIMENSIONS.find(
                    (d) => d.width === width && d.height === height
                  );

                  if (dimension?.premium) {
                    handleOptionChange(
                      "width",
                      width,
                      "highResolution",
                      featureAccess.highResolution.requiredPlan
                    );
                    handleOptionChange(
                      "height",
                      height,
                      "highResolution",
                      featureAccess.highResolution.requiredPlan
                    );
                  } else {
                    setOptions((prev) => ({ ...prev, width, height }));
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select dimensions" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_DIMENSIONS.map((dim) => (
                    <SelectItem
                      key={dim.label}
                      value={`${dim.width}x${dim.height}`}
                    >
                      <div className="flex items-center gap-2">
                        <span>{dim.label}</span>
                        {dim.premium && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Pro
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Count */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">
                  Image Count: {options.count}
                </label>
                <span className="text-xs text-muted-foreground">
                  Max: {maxImageCount}
                </span>
              </div>
              <Slider
                value={[options.count]}
                onValueChange={(value) => {
                  const newCount = value[0];
                  if (newCount > maxImageCount) {
                    onPremiumRequired(
                      "multiple images",
                      featureAccess.multipleImages.requiredPlan || "basic"
                    );
                    return;
                  }
                  handleOptionChange("count", newCount);
                }}
                min={1}
                max={Math.max(maxImageCount, 10)}
                step={1}
              />
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Steps */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">
                    Steps: {options.steps}
                  </label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>More steps = higher quality but slower generation</p>
                    </TooltipContent>
                  </Tooltip>
                  {!featureAccess.advancedSettings.hasAccess && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Pro
                    </Badge>
                  )}
                </div>
                <Slider
                  value={[options.steps]}
                  onValueChange={(value) =>
                    handleOptionChange(
                      "steps",
                      value[0],
                      "advancedSettings",
                      featureAccess.advancedSettings.requiredPlan
                    )
                  }
                  min={10}
                  max={150}
                  step={1}
                  disabled={!featureAccess.advancedSettings.hasAccess}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Fast (10)</span>
                  <span>Balanced (30)</span>
                  <span>Quality (150)</span>
                </div>
              </div>

              {/* CFG Scale */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">
                    CFG Scale: {options.cfg}
                  </label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>How closely to follow the prompt (1-20)</p>
                    </TooltipContent>
                  </Tooltip>
                  {!featureAccess.advancedSettings.hasAccess && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Pro
                    </Badge>
                  )}
                </div>
                <Slider
                  value={[options.cfg]}
                  onValueChange={(value) =>
                    handleOptionChange(
                      "cfg",
                      value[0],
                      "advancedSettings",
                      featureAccess.advancedSettings.requiredPlan
                    )
                  }
                  min={1}
                  max={20}
                  step={0.5}
                  disabled={!featureAccess.advancedSettings.hasAccess}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Creative (1)</span>
                  <span>Balanced (7.5)</span>
                  <span>Strict (20)</span>
                </div>
              </div>

              {/* CLIP Skip */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">
                    CLIP Skip: {options.clipSkip}
                  </label>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Skip layers in CLIP text encoder</p>
                    </TooltipContent>
                  </Tooltip>
                  {!featureAccess.advancedSettings.hasAccess && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Pro
                    </Badge>
                  )}
                </div>
                <Slider
                  value={[options.clipSkip]}
                  onValueChange={(value) =>
                    handleOptionChange(
                      "clipSkip",
                      value[0],
                      "advancedSettings",
                      featureAccess.advancedSettings.requiredPlan
                    )
                  }
                  min={1}
                  max={12}
                  step={1}
                  disabled={!featureAccess.advancedSettings.hasAccess}
                />
              </div>

              {/* Seed */}
              <div>
                <label className="block text-sm font-medium mb-2">Seed</label>
                <Input
                  type="text"
                  value={options.seed}
                  onChange={(e) => handleOptionChange("seed", e.target.value)}
                  placeholder="Random if empty"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Use the same seed for reproducible results
                </p>
              </div>
            </div>

            <Separator />

            {/* Sampler & Scheduler */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Sampler</label>
                  {!featureAccess.advancedSettings.hasAccess && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Pro
                    </Badge>
                  )}
                </div>
                <Select
                  value={options.sampler}
                  onValueChange={(value) =>
                    handleOptionChange(
                      "sampler",
                      value,
                      "advancedSettings",
                      featureAccess.advancedSettings.requiredPlan
                    )
                  }
                  disabled={!featureAccess.advancedSettings.hasAccess}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select sampler" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_SAMPLERS.map((sampler) => (
                      <SelectItem key={sampler.id} value={sampler.id}>
                        <div className="flex items-center gap-2">
                          <span>{sampler.name}</span>
                          {sampler.premium && (
                            <Badge variant="secondary" className="text-xs">
                              <Lock className="w-3 h-3 mr-1" />
                              Pro
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Scheduler</label>
                  {!featureAccess.advancedSettings.hasAccess && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Pro
                    </Badge>
                  )}
                </div>
                <Select
                  value={options.scheduler}
                  onValueChange={(value) =>
                    handleOptionChange(
                      "scheduler",
                      value,
                      "advancedSettings",
                      featureAccess.advancedSettings.requiredPlan
                    )
                  }
                  disabled={!featureAccess.advancedSettings.hasAccess}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scheduler" />
                  </SelectTrigger>
                  <SelectContent>
                    {AVAILABLE_SCHEDULERS.map((scheduler) => (
                      <SelectItem key={scheduler.id} value={scheduler.id}>
                        <div className="flex items-center gap-2">
                          <span>{scheduler.name}</span>
                          {scheduler.premium && (
                            <Badge variant="secondary" className="text-xs">
                              <Lock className="w-3 h-3 mr-1" />
                              Pro
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Style & Effects Tab */}
          <TabsContent value="style" className="space-y-6">
            {/* LoRA Model */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium">LoRA Model</label>
                <Tooltip>
                  <TooltipTrigger>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Low-Rank Adaptation models for specific styles</p>
                  </TooltipContent>
                </Tooltip>
                {!featureAccess.advancedSettings.hasAccess && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="w-3 h-3 mr-1" />
                    Pro
                  </Badge>
                )}
              </div>
              <Select
                value={options.loraModel}
                onValueChange={(value) =>
                  handleOptionChange(
                    "loraModel",
                    value,
                    "advancedSettings",
                    featureAccess.advancedSettings.requiredPlan
                  )
                }
                disabled={!featureAccess.advancedSettings.hasAccess}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select LoRA model" />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_LORAS.map((lora) => (
                    <SelectItem key={lora.id} value={lora.id}>
                      <div className="flex items-center gap-2">
                        <span>{lora.name}</span>
                        {lora.premium && (
                          <Badge variant="secondary" className="text-xs">
                            <Lock className="w-3 h-3 mr-1" />
                            Pro
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* LoRA Strength */}
            {options.loraModel && options.loraModel !== "none" && (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">
                    LoRA Strength: {options.loraStrength}
                  </label>
                  {!featureAccess.advancedSettings.hasAccess && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Pro
                    </Badge>
                  )}
                </div>
                <Slider
                  value={[options.loraStrength]}
                  onValueChange={(value) =>
                    handleOptionChange(
                      "loraStrength",
                      value[0],
                      "advancedSettings",
                      featureAccess.advancedSettings.requiredPlan
                    )
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  disabled={!featureAccess.advancedSettings.hasAccess}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Subtle (0)</span>
                  <span>Balanced (0.8)</span>
                  <span>Strong (1)</span>
                </div>
              </div>
            )}

            {/* Enhance Style */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <label className="text-sm font-medium">Enhance Style</label>
                {!featureAccess.advancedSettings.hasAccess && (
                  <Badge variant="secondary" className="text-xs">
                    <Lock className="w-3 h-3 mr-1" />
                    Pro
                  </Badge>
                )}
              </div>
              <Select
                value={options.enhanceStyle}
                onValueChange={(value) =>
                  handleOptionChange(
                    "enhanceStyle",
                    value,
                    "advancedSettings",
                    featureAccess.advancedSettings.requiredPlan
                  )
                }
                disabled={!featureAccess.advancedSettings.hasAccess}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select enhancement style" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {ENHANCE_STYLES.map((style) => (
                    <SelectItem key={style.id} value={style.id}>
                      {style.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Upscaling */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">
                    Enable Upscaling
                  </label>
                  {!featureAccess.upscaling.hasAccess && (
                    <Badge variant="secondary" className="text-xs">
                      <Lock className="w-3 h-3 mr-1" />
                      Pro
                    </Badge>
                  )}
                </div>
                <Switch
                  checked={options.upscale}
                  onCheckedChange={(checked) =>
                    handleOptionChange(
                      "upscale",
                      checked,
                      "upscaling",
                      featureAccess.upscaling.requiredPlan
                    )
                  }
                  disabled={!featureAccess.upscaling.hasAccess}
                />
              </div>

              {options.upscale && (
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Upscale Strength: {options.upscaleStrength}x
                  </label>
                  <Slider
                    value={[options.upscaleStrength]}
                    onValueChange={(value) =>
                      handleOptionChange("upscaleStrength", value[0])
                    }
                    min={1}
                    max={4}
                    step={0.1}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>1x (Original)</span>
                    <span>2x (Double)</span>
                    <span>4x (Quad)</span>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate Button */}
        <Button
          onClick={handleSubmit}
          disabled={
            isGenerating || !validation.isValid || !options.prompt.trim()
          }
          className="w-full"
          size="lg"
        >
          {isGenerating ? (
            <>
              <Zap className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Zap className="w-4 h-4 mr-2" />
              Generate Images ({estimatedCost} TEMPT)
            </>
          )}
        </Button>

        {/* Form Status */}
        <div className="text-center text-sm text-muted-foreground">
          {validation.isValid ? (
            <span className="text-green-600">✓ Ready to generate</span>
          ) : (
            <span className="text-red-600">✗ Please fix validation errors</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
