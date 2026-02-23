import type { ModelConfig, VideoModelConfig } from "./types"
export const BASE_URL = process.env.AI_IMAGE_BASE_URL
export const API_URL = `${BASE_URL}/generate`
export const apiKey = process.env.MODELS_LAB_API_KEY || ""

export const GPU_API_KEY = process.env.GPU_API_KEY || process.env.MODELS_LAB_API_KEY || ""

export const VIDEO_BASE_URL = process.env.AI_VIDEO_BASE_URL || BASE_URL
export const VIDEO_API_URL = `${VIDEO_BASE_URL}/video/generate-video`
export const VIDEO_FETCH_URL = `${VIDEO_BASE_URL}/video/fetch-video/`

const NEGATIVE_BASE =
  "(worst quality, low quality:1.4), blurry, bad anatomy, extra fingers, extra limbs, " +
  "poorly drawn hands, deformed, jpeg artifacts, oversharpened, plastic skin, " +
  "watermark, text, logo, cgi, 3d render, cartoon, doll skin, smooth skin"

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  flux: {
    lora_model: "uncensored-flux-lora",
    lora_strength: 0.8,
    num_inference_steps: 42,
    guidance_scale: 6.8,
    model_id: "",
    // Quality optimization — SD 1.5 realism stack
    negative_prompt: NEGATIVE_BASE,
    sampler: "dpmpp_2m_karras",
    hires_fix: true,
    hires_scale: 1.75,
    hires_denoise: 0.4,
    hires_steps: 28,
    face_restore: true,
    face_restore_strength: 0.2,
  },
  sdxl: {
    num_inference_steps: 42,
    guidance_scale: 6.8,
    enhance_style: "nude",
    model_id: "",
    negative_prompt: NEGATIVE_BASE,
    sampler: "dpmpp_2m_karras",
    hires_fix: true,
    hires_scale: 1.75,
    hires_denoise: 0.4,
    hires_steps: 28,
    face_restore: true,
    face_restore_strength: 0.2,
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
