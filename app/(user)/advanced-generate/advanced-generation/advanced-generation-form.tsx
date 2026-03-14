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
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Info, AlertCircle, CheckCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  DEFAULT_OPTIONS,
  MODEL_OPTION_DEFAULTS,
  AVAILABLE_SAMPLERS,
  AVAILABLE_DIMENSIONS,
  AVAILABLE_LORAS,
  calculateGenerationCost,
  validateGenerationOptions,
  type GenerationOptions,
  type LoraConfig,
} from "../advanced-generation-utils";
import { GPU_MODELS } from "@/app/(user)/gallery/components/GenerationForm/features/model-selector";
import { toast } from "sonner";

interface AdvancedGenerationFormProps {
  subscriptionStatus?: unknown;
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
  onGenerate,
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

  const estimatedCost = calculateGenerationCost(options);

  const validateForm = useCallback(
    (currentOptions: GenerationOptions): FormValidation => {
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!currentOptions.prompt.trim()) {
        errors.push("Prompt is required");
      }
      if (currentOptions.prompt.length > 1000) {
        warnings.push("Very long prompts may not work as expected");
      }
      if (currentOptions.steps < 10) {
        warnings.push("Very low step count may produce poor quality");
      }
      if (currentOptions.steps > 80) {
        warnings.push("High step count significantly increases generation time");
      }
      if (currentOptions.cfg > 15) {
        warnings.push("Very high CFG scale may produce over-saturated images");
      }

      const subscriptionValidation = validateGenerationOptions(currentOptions, undefined);
      if (!subscriptionValidation.isValid) {
        errors.push(...subscriptionValidation.errors);
      }

      return { isValid: errors.length === 0, errors, warnings };
    },
    []
  );

  // Initialize from URL params
  useEffect(() => {
    if (!searchParams) return;
    const urlOptions: Partial<GenerationOptions> = {};

    const stringKeys: (keyof GenerationOptions)[] = ["prompt", "negativePrompt", "seed", "modelId", "sampler"];
    const numberKeys: (keyof GenerationOptions)[] = ["steps", "cfg", "width", "height", "count", "hiresScale", "hiresDenoise", "hiresSteps", "faceRestoreStrength"];
    const boolKeys: (keyof GenerationOptions)[] = ["hiresFix", "faceRestore"];

    stringKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value !== null) (urlOptions as Record<string, unknown>)[key] = value;
    });
    numberKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value !== null) (urlOptions as Record<string, unknown>)[key] = Number(value);
    });
    boolKeys.forEach((key) => {
      const value = searchParams.get(key);
      if (value !== null) (urlOptions as Record<string, unknown>)[key] = value === "true";
    });

    if (Object.keys(urlOptions).length > 0) {
      setOptions((prev) => ({ ...prev, ...urlOptions }));
      setIsFormDirty(true);
    }
  }, [searchParams]);

  useEffect(() => {
    setValidation(validateForm(options));
  }, [options, validateForm]);

  const handleOptionChange = <K extends keyof GenerationOptions>(
    key: K,
    value: GenerationOptions[K]
  ) => {
    setOptions((prev) => ({ ...prev, [key]: value }));
    setIsFormDirty(true);
  };

  const handleSubmit = () => {
    if (!validation.isValid) {
      toast.error("Please fix validation errors");
      return;
    }
    if (validation.warnings.length > 0) {
      toast.warning(validation.warnings[0]);
    }
    onGenerate(options);
    setIsFormDirty(false);
  };

  const resetForm = () => {
    setOptions(DEFAULT_OPTIONS);
    setIsFormDirty(false);
    toast.success("Settings reset to defaults");
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Advanced Generation</h2>
              <p className="text-sm text-muted-foreground">
                SD 1.5 &mdash; uberRealisticPornMerge &mdash; RTX 3090
              </p>
            </div>
            {isFormDirty && (
              <Button variant="outline" size="sm" onClick={resetForm}>
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* Validation Alerts */}
        {validation.errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {validation.errors.map((error, i) => (
                <div key={i}>&bull; {error}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {validation.warnings.length > 0 && (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {validation.warnings.map((w, i) => (
                <div key={i}>&bull; {w}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {/* Cost */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Estimated Cost</p>
                <p className="text-2xl font-bold text-primary">{estimatedCost} TEMPT</p>
              </div>
              <div className="text-right space-y-1">
                <p className="text-sm text-muted-foreground">Images: {options.count}</p>
                <p className="text-sm text-muted-foreground">{options.width}&times;{options.height}</p>
                {validation.isValid && (
                  <div className="flex items-center text-green-600 text-sm">
                    <CheckCircle className="w-4 h-4 mr-1" />
                    Ready
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="basic" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="basic">Basic</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>

          {/* Basic Tab */}
          <TabsContent value="basic" className="space-y-6">
            {/* Model */}
            <div>
              <label className="block text-sm font-medium mb-2">Model</label>
              <Select
                value={options.modelId}
                onValueChange={(modelId) => {
                  const defaults = MODEL_OPTION_DEFAULTS[modelId]
                  setOptions((prev) => ({
                    ...prev,
                    modelId,
                    ...(defaults ?? {}),
                  }))
                  setIsFormDirty(true)
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GPU_MODELS.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      <span className="font-medium">{m.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{m.description}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Steps, CFG, and sampler auto-load optimal defaults for the selected model
              </p>
            </div>

            {/* Prompt */}
            <div>
              <label className="block text-sm font-medium mb-2">Prompt *</label>
              <Textarea
                value={options.prompt}
                onChange={(e) => handleOptionChange("prompt", e.target.value)}
                className="min-h-[100px]"
                placeholder="Describe what you want to generate..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Tip: Use (word:1.2) for emphasis, (word:0.8) to reduce weight
              </p>
            </div>

            {/* Negative Prompt */}
            <div>
              <label className="block text-sm font-medium mb-2">Negative Prompt</label>
              <Textarea
                value={options.negativePrompt}
                onChange={(e) => handleOptionChange("negativePrompt", e.target.value)}
                className="min-h-[80px]"
                placeholder="What you do not want to see (deformed, blurry, low quality...)"
              />
            </div>

            {/* Dimensions */}
            <div>
              <label className="block text-sm font-medium mb-2">Dimensions</label>
              <Select
                value={`${options.width}x${options.height}`}
                onValueChange={(value) => {
                  const [width, height] = value.split("x").map(Number);
                  setOptions((prev) => ({ ...prev, width, height }));
                  setIsFormDirty(true);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_DIMENSIONS.map((dim) => (
                    <SelectItem key={dim.label} value={`${dim.width}x${dim.height}`}>
                      {dim.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Image Count */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Images: {options.count}</label>
                <span className="text-xs text-muted-foreground">Max: 4</span>
              </div>
              <Slider
                value={[options.count]}
                onValueChange={(v) => handleOptionChange("count", v[0])}
                min={1}
                max={4}
                step={1}
              />
            </div>

            {/* Seed */}
            <div>
              <label className="block text-sm font-medium mb-2">Seed</label>
              <Input
                type="text"
                value={options.seed}
                onChange={(e) => handleOptionChange("seed", e.target.value)}
                placeholder="Random (leave empty)"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Same seed + same prompt = same image
              </p>
            </div>
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent value="advanced" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Steps */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">Steps: {options.steps}</label>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p>More steps = higher quality but slower</p></TooltipContent>
                  </Tooltip>
                </div>
                <Slider
                  value={[options.steps]}
                  onValueChange={(v) => handleOptionChange("steps", v[0])}
                  min={10}
                  max={100}
                  step={1}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Fast (10)</span>
                  <span>Default (42)</span>
                  <span>Max (100)</span>
                </div>
              </div>

              {/* CFG Scale */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <label className="text-sm font-medium">CFG Scale: {options.cfg}</label>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p>How closely to follow the prompt</p></TooltipContent>
                  </Tooltip>
                </div>
                <Slider
                  value={[options.cfg]}
                  onValueChange={(v) => handleOptionChange("cfg", v[0])}
                  min={1}
                  max={20}
                  step={0.5}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>Creative (1)</span>
                  <span>Default (6.8)</span>
                  <span>Strict (20)</span>
                </div>
              </div>
            </div>

            {/* Sampler */}
            <div>
              <label className="block text-sm font-medium mb-2">Sampler</label>
              <Select
                value={options.sampler}
                onValueChange={(v) => handleOptionChange("sampler", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AVAILABLE_SAMPLERS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Hires Fix */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">High-Res Fix</label>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p>Generates at base resolution then upscales with refinement pass</p></TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={options.hiresFix}
                  onCheckedChange={(v) => handleOptionChange("hiresFix", v)}
                />
              </div>

              {options.hiresFix && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pl-4 border-l-2 border-muted">
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Scale: {options.hiresScale}x
                    </label>
                    <Slider
                      value={[options.hiresScale]}
                      onValueChange={(v) => handleOptionChange("hiresScale", v[0])}
                      min={1}
                      max={4}
                      step={0.25}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Denoise: {options.hiresDenoise}
                    </label>
                    <Slider
                      value={[options.hiresDenoise]}
                      onValueChange={(v) => handleOptionChange("hiresDenoise", v[0])}
                      min={0.1}
                      max={0.99}
                      step={0.05}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Steps: {options.hiresSteps}
                    </label>
                    <Slider
                      value={[options.hiresSteps]}
                      onValueChange={(v) => handleOptionChange("hiresSteps", v[0])}
                      min={10}
                      max={50}
                      step={1}
                    />
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Face Restore */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">Face Restore (GFPGAN)</label>
                  <Tooltip>
                    <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                    <TooltipContent><p>Fix face details. Keep strength low (0.1-0.3) for realism.</p></TooltipContent>
                  </Tooltip>
                </div>
                <Switch
                  checked={options.faceRestore}
                  onCheckedChange={(v) => handleOptionChange("faceRestore", v)}
                />
              </div>

              {options.faceRestore && (
                <div className="pl-4 border-l-2 border-muted">
                  <label className="text-sm font-medium mb-2 block">
                    Strength: {options.faceRestoreStrength}
                  </label>
                  <Slider
                    value={[options.faceRestoreStrength]}
                    onValueChange={(v) => handleOptionChange("faceRestoreStrength", v[0])}
                    min={0}
                    max={1}
                    step={0.05}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Subtle (0)</span>
                    <span>Default (0.2)</span>
                    <span>Strong (1)</span>
                  </div>
                </div>
              )}
            </div>
            <Separator />

            {/* LoRA Styles */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Style LoRAs</label>
                <Tooltip>
                  <TooltipTrigger><Info className="w-4 h-4 text-muted-foreground" /></TooltipTrigger>
                  <TooltipContent><p>Apply style modifiers to change the look of your generation. Stack multiple for unique effects.</p></TooltipContent>
                </Tooltip>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {AVAILABLE_LORAS.map((lora) => {
                  const isActive = options.loras.some((l) => l.id === lora.id);
                  const activeLora = options.loras.find((l) => l.id === lora.id);

                  return (
                    <Card
                      key={lora.id}
                      className={`cursor-pointer transition-all ${
                        isActive ? "ring-2 ring-primary bg-primary/5" : "hover:bg-muted/50"
                      }`}
                      onClick={() => {
                        if (isActive) {
                          handleOptionChange(
                            "loras",
                            options.loras.filter((l) => l.id !== lora.id)
                          );
                        } else {
                          handleOptionChange("loras", [
                            ...options.loras,
                            { id: lora.id, strength: lora.defaultStrength },
                          ]);
                        }
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">{lora.name}</p>
                            <p className="text-xs text-muted-foreground">{lora.description}</p>
                          </div>
                          {isActive && (
                            <div className="text-xs text-primary font-medium">ON</div>
                          )}
                        </div>
                        {isActive && activeLora && (
                          <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between text-xs mb-1">
                              <span>Strength: {activeLora.strength}</span>
                            </div>
                            <Slider
                              value={[activeLora.strength]}
                              onValueChange={(v) => {
                                handleOptionChange(
                                  "loras",
                                  options.loras.map((l) =>
                                    l.id === lora.id ? { ...l, strength: v[0] } : l
                                  )
                                );
                              }}
                              min={0.1}
                              max={1.5}
                              step={0.1}
                            />
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {options.loras.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {options.loras.length} LoRA{options.loras.length > 1 ? "s" : ""} active &mdash;{" "}
                  <button
                    className="underline text-primary"
                    onClick={() => handleOptionChange("loras", [])}
                  >
                    clear all
                  </button>
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {/* Generate Button */}
        <Button
          onClick={handleSubmit}
          disabled={isGenerating || !validation.isValid || !options.prompt.trim()}
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
              Generate ({estimatedCost} TEMPT)
            </>
          )}
        </Button>

        <div className="text-center text-sm text-muted-foreground">
          {validation.isValid ? (
            <span className="text-green-600">Ready to generate</span>
          ) : (
            <span className="text-red-600">Please fix validation errors</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
