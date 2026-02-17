// import { cdnFileType } from "clodynix";

export interface ImageResult {
  imageUrl: string;
  cdnUrl?: string;
  prompt: string;
  seed?: number;
  modelId?: string;
  steps?: number;
  cfg?: number;
  sampler?: string;
  path: string;
}

export interface ImageError {
  seed: number;
  error: string;
}

export interface ModelConfig {
  model_id: string;
  lora_model?: string;
  lora_strength?: number;
  num_inference_steps: number;
  guidance_scale: number;
  enhance_style?: string;
}

export interface GenerateImagesParams {
  prompt: string;
  seeds: number[];
  count?: number;
  modelConfig?: ModelConfig;
  width?: number;
  height?: number;
}

export type ModelslabResponse = {
  status: 'success' | 'processing' | 'failed' | 'error';
  tip?: string;
  tip_1?: string;
  eta?: number;
  messege: string;
  webhook_status?: string;
  fetch_result?: string;
  id?: number;
  output: string[];
  meta: {
    prompt: string;
    model_id: string;
    negative_prompt: string;
    width: number;
    height: number;
    guidance_scale: number;
    seed: number;
    steps: number;
    n_samples: number;
    full_url: string;
    instant_response: string;
    ip_adapter_id: string | null;
    ip_adapter_scale: number;
    ip_adapter_image: string | null;
    safety_checker: string;
    safety_checker_type: string;
    lora: string;
    lora_strength: string;
    watermark: string;
    temp: string;
    base64: string;
    webhook: string | null;
    track_id: string | null;
    id: string | null;
    file_prefix: string;
    output: string[];
  };
  future_links: string[];
};

export interface PollResult extends ModelslabResponse {
}

