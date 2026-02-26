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

// Cost model: RTX 3090 on vast.ai ~$0.50/hr
// At 25 steps DPM++ 2M Karras: ~5-6s/image → ~600 imgs/hr → $0.00083/image at u=1
// At 42 steps (old): ~9s/image → ~400 imgs/hr — same quality, 40% slower
export const GPU_COST_PER_HOUR_USD = 0.50 // vast.ai RTX 3090 estimate
export const AVG_SECONDS_PER_IMAGE = 6    // 25-step DPM++ 2M Karras on 3090

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  flux: {
    lora_model: "uncensored-flux-lora",
    lora_strength: 0.8,
    num_inference_steps: 25, // Reduced from 42 — DPM++ 2M Karras converges fast, same quality
    guidance_scale: 6.8,
    model_id: "",
    // Quality optimization — SD 1.5 realism stack
    negative_prompt: NEGATIVE_BASE,
    sampler: "dpmpp_2m_karras",
    hires_fix: true,
    hires_scale: 1.75,
    hires_denoise: 0.4,
    hires_steps: 18, // Reduced from 28 — hires pass needs fewer steps
    face_restore: true,
    face_restore_strength: 0.2,
  },
  sdxl: {
    num_inference_steps: 25, // Reduced from 42
    guidance_scale: 6.8,
    enhance_style: "nude",
    model_id: "",
    negative_prompt: NEGATIVE_BASE,
    sampler: "dpmpp_2m_karras",
    hires_fix: true,
    hires_scale: 1.75,
    hires_denoise: 0.4,
    hires_steps: 18, // Reduced from 28
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
