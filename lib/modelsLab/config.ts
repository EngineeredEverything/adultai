import { ModelConfig } from "./types";

export const API_URL = 'https://modelslab.com/api/v6/images/text2img';
export const apiKey = process.env.MODELS_LAB_API_KEY || '';
export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  'flux': {
    model_id: "flux",
    lora_model: "uncensored-flux-lora",
    lora_strength: 0.8,
    num_inference_steps: 30,
    guidance_scale: 7.5
  },
  'sdxl': {
    model_id: "nsfw-sdxl",
    num_inference_steps: 30,
    guidance_scale: 7.5,
    enhance_style: "nude"
  }
} as const;
