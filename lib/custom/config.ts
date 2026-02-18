import type { ModelConfig, VideoModelConfig } from "./types"
export const BASE_URL = process.env.AI_IMAGE_BASE_URL
export const API_URL = `${BASE_URL}/generate`
export const apiKey = process.env.MODELS_LAB_API_KEY || ""

export const VIDEO_BASE_URL = process.env.AI_VIDEO_BASE_URL || BASE_URL
export const VIDEO_API_URL = `${VIDEO_BASE_URL}/video/generate-video`
export const VIDEO_FETCH_URL = `${VIDEO_BASE_URL}/video/fetch-video/`

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  flux: {
    lora_model: "uncensored-flux-lora",
    lora_strength: 0.8,
    num_inference_steps: 30,
    guidance_scale: 7.5,
    model_id: "",
  },
  sdxl: {
    num_inference_steps: 30,
    guidance_scale: 7.5,
    enhance_style: "nude",
    model_id: "",
  },
} as const

export const VIDEO_CONFIGS: Record<string, VideoModelConfig> = {
  default: {
    fps: 24,
    guidance_scale: 7.5,
    height: 480,
    num_frames: 81,
    num_inference_steps: 50,
    width: 848,
    prompt: "",
    seed: 0,
  },
} as const
