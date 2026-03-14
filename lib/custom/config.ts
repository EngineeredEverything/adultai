import type { ModelConfig, VideoModelConfig } from "./types"
export const BASE_URL = process.env.AI_IMAGE_BASE_URL
export const API_URL = `${BASE_URL}/generate`
export const apiKey = process.env.MODELS_LAB_API_KEY || ""

export const GPU_API_KEY = process.env.GPU_API_KEY || process.env.MODELS_LAB_API_KEY || ""

export const VIDEO_BASE_URL = process.env.AI_VIDEO_BASE_URL || BASE_URL
export const VIDEO_API_URL = `${VIDEO_BASE_URL}/video/generate-video`
export const VIDEO_FETCH_URL = `${VIDEO_BASE_URL}/video/fetch-video/`

// ── Shared negative prompt bases ─────────────────────────────────────────────

// Generic SD1.5 / Flux negative
const NEGATIVE_BASE =
  "(worst quality, low quality:1.4), blurry, bad anatomy, extra fingers, extra limbs, " +
  "poorly drawn hands, deformed, jpeg artifacts, oversharpened, plastic skin, " +
  "watermark, text, logo, cgi, 3d render, cartoon, doll skin, smooth skin, " +
  "child, minor, underage, censored, mosaic, bar censor, clothes when nude requested"

// Pony / SDXL photorealistic models (CyberRealistic Pony, Pony Realism, DAMN!, Lustify)
const NEGATIVE_PONY_REALISTIC =
  "score_6, score_5, score_4, score_3, score_2, score_1, " +
  "(worst quality, low quality:1.4), blurry, bad anatomy, extra fingers, extra limbs, " +
  "poorly drawn hands, deformed, jpeg artifacts, watermark, text, logo, " +
  "3d render, cartoon, anime, illustration, painting, drawing, sketch, " +
  "cgi, doll skin, plastic skin, mannequin, oversaturated, overexposed, flat lighting, " +
  "child, minor, underage, censored, mosaic, bar censor"

// Pony Diffusion V6 XL — fantasy / creatures / anthro model
const NEGATIVE_PONY_FANTASY =
  "score_4, score_3, score_2, score_1, " +
  "worst quality, low quality, normal quality, lowres, bad anatomy, bad hands, " +
  "extra limb, missing limb, ugly, imperfect eyes, watermark, text, signature, " +
  "child, minor, underage"

// Cost model: RTX 3090 on vast.ai ~$0.50/hr
export const GPU_COST_PER_HOUR_USD = 0.50
export const AVG_SECONDS_PER_IMAGE = 9

// ── Per-model configs ─────────────────────────────────────────────────────────
// Settings sourced from official Civitai model pages and community benchmarks.
// GPU generation.py auto-injects score_9/score_8_up/score_7_up prefix for all pony models.

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
  // ── Flux + uncensored LoRA (legacy fallback) ──────────────────────────────
  flux: {
    model_id: "",
    lora_model: "uncensored-flux-lora",
    lora_strength: 0.8,
    num_inference_steps: 42,
    guidance_scale: 6.8,
    negative_prompt: NEGATIVE_BASE,
    sampler: "dpmpp_2m_karras",
    hires_fix: true,
    hires_scale: 1.75,
    hires_denoise: 0.4,
    hires_steps: 28,
    face_restore: true,
    face_restore_strength: 0.2,
  },

  // ── Generic SDXL fallback ─────────────────────────────────────────────────
  sdxl: {
    model_id: "",
    num_inference_steps: 42,
    guidance_scale: 6.8,
    enhance_style: "nude",
    negative_prompt: NEGATIVE_BASE,
    sampler: "dpmpp_2m_karras",
    hires_fix: true,
    hires_scale: 1.75,
    hires_denoise: 0.4,
    hires_steps: 28,
    face_restore: true,
    face_restore_strength: 0.2,
  },

  // ── CyberRealistic Pony v16 — Default Photorealistic ─────────────────────
  // Source: https://civitai.com/models/443821/cyberrealistic-pony (v16+)
  // RESEARCH-BACKED: "30+ steps, CFG 5, DPM++ SDE Karras, Clip Skip 2"
  // Architecture: SDXL (Pony base) — photorealistic, beautiful faces, moody lighting
  // Best for: Cinematic portraits, skin detail, expressive scenes, natural beauty
  cyberrealistic_pony: {
    model_id: "cyberrealistic_pony",
    num_inference_steps: 35,
    guidance_scale: 5,
    negative_prompt: NEGATIVE_PONY_REALISTIC,
    sampler: "dpmpp_sde_karras",
    clip_skip: 2,
    hires_fix: true,
    hires_scale: 1.5,
    hires_denoise: 0.35,
    hires_steps: 19, // ~55% of base
    face_restore: true,
    face_restore_strength: 0.25,
  },

  // ── Pony Realism v2.2 — Hyper-Detail Photorealism ──────────────────────
  // Source: https://civitai.com/models/372465/pony-realism
  // RESEARCH-BACKED: "Euler A, 20-30 steps, CFG 7, Clip Skip 2" (HF) + "DPM++ SDE 12+ steps" (Reddit)
  // Architecture: SDXL (Pony) — extreme skin texture detail, anatomy precision
  // Best for: Close-ups, skin texture, anatomy detail, high-resolution showcase
  pony_realism: {
    model_id: "pony_realism",
    num_inference_steps: 35,
    guidance_scale: 6.5,
    negative_prompt: NEGATIVE_PONY_REALISTIC,
    sampler: "euler_a",
    clip_skip: 2,
    hires_fix: true,
    hires_scale: 1.5,
    hires_denoise: 0.35,
    hires_steps: 19, // ~55% of base
    face_restore: true,
    face_restore_strength: 0.25,
  },

  // ── DAMN! v5 — Illustrious/Diverse Artistic Realism ─────────────────────
  // Source: https://civitai.com/models/428826/damn-illustriouspony-realistic-model
  // RESEARCH-BACKED: "DPM++ 2M/3M SDE, 30-40 steps, CFG 3-6 (3=realism, 6=stylized)"
  // Architecture: Illustrious (NOT Pony) — diverse styles, strong anatomy, semi-realistic
  // Best for: Mixed styles, artistic realism, diverse characters, flexible prompt adherence
  // NOTE: Illustrious base — score_ tags have NO effect. Use "masterpiece, best quality" instead.
  damn_pony: {
    model_id: "damn_pony",
    num_inference_steps: 36,
    guidance_scale: 5,
    negative_prompt: "bad quality, worst quality, low quality, " + NEGATIVE_PONY_REALISTIC,
    sampler: "dpmpp_2m_sde",
    clip_skip: 1,
    hires_fix: true,
    hires_scale: 1.5,
    hires_denoise: 0.35,
    hires_steps: 20, // ~55% of base
    face_restore: true,
    face_restore_strength: 0.25,
  },

  // ── Lustify SDXL v7 — NSFW Optimized Photorealism ──────────────────────
  // Source: civitai.com/models/573152 (HuggingFace: TheImposterImposters/LUSTIFY-v2.0)
  // RESEARCH-BACKED: "DPM++ 2M/3M SDE, 30 steps, CFG 4-7, Exponential/Karras scheduler"
  // Architecture: SDXL — explicit-optimized, strong prompt adherence, NSFW detail
  // Best for: NSFW photorealism, explicit anatomical detail, direct prompt translation
  lustify: {
    model_id: "lustify",
    num_inference_steps: 32,
    guidance_scale: 6,
    negative_prompt: NEGATIVE_PONY_REALISTIC,
    sampler: "dpmpp_2m_sde",
    clip_skip: 1,
    hires_fix: true,
    hires_scale: 1.4,
    hires_denoise: 0.35,
    hires_steps: 18, // ~55% of base
    face_restore: true,
    face_restore_strength: 0.25,
  },

  // ── Pony Diffusion V6 XL — Fantasy & Creatures ────────────────────────────
  // Source: https://civitai.com/models/257749/pony-diffusion-v6-xl
  // RESEARCH-BACKED: "Euler a 25 steps, CFG 7-9, Clip Skip 2, 1024px resolution"
  // Architecture: SDXL (Pony) — fantasy creatures, anthro, feral, all species + NSFW
  // Quality tags: score_9, score_8_up, ... score_4_up (GPU auto-injects for this model)
  // Rating tags: rating_explicit, rating_questionable
  // Best for: Creatures, anthro, furry, feral, fantasy, mythical beings, all species
  pony_diffusion: {
    model_id: "pony_diffusion",
    num_inference_steps: 28,
    guidance_scale: 7.5,
    negative_prompt: NEGATIVE_PONY_FANTASY,
    sampler: "euler_a",
    clip_skip: 2,
    hires_fix: true,
    hires_scale: 1.5,
    hires_denoise: 0.3,
    hires_steps: 15, // ~55% of base
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
