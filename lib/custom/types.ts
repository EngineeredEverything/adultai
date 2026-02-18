// types.ts
export interface ModelConfig {
  model_id?: any
  lora_model?: string
  lora_strength?: number
  num_inference_steps: number
  guidance_scale: number
  enhance_style?: string
}

export interface GenerateImagesParams {
  prompt: string
  seeds: number[]
  count?: number
  modelConfig?: ModelConfig
  width?: number
  height?: number
}

export interface ImageResult {
  imageBase64?: string
  cdnUrl: string
  prompt: string
  seed: number
  modelId: string
  steps: number
  cfg: number
  sampler: string
  path: string
}

// Simplified response format based on the Python example
export interface ModelslabResponse {
  image?: string // Base64 encoded image
  status?: string
  message?: string
}

export interface VideoModelConfig {
  fps?: number
  guidance_scale: number
  height: number
  negative_prompt?: string
  num_frames: number
  num_inference_steps: number
  prompt: string
  seed: number
  width: number
}

export interface GenerateVideosParams {
  prompt: string
  seeds: number[]
  count?: number
  videoConfig?: VideoModelConfig
  width?: number
  height?: number
  fps?: number
  numFrames?: number
  negativePrompt?: string
}

export interface VideoResult {
  videoBase64?: string
  cdnUrl: string
  prompt: string
  seed: number
  steps: number
  cfg: number
  path: string
  fps: number
  numFrames: number
  width: number
  height: number
}

export interface VideoGenerationResponse {
  video?: string // Base64 encoded video or URL
  status?: string
  message?: string
  id?: string
  eta?: number
  future_links?: string[]
}
