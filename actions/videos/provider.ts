import * as CUSTOM_CONFIG from "@/lib/custom/config"
import * as CUSTOM_VIDEO_GENERATION from "@/lib/custom/video-generation"

interface CustomVideoProvider {
  apiKey: typeof CUSTOM_CONFIG.apiKey
  VIDEO_CONFIGS: typeof CUSTOM_CONFIG.VIDEO_CONFIGS
  VIDEO_API_URL: typeof CUSTOM_CONFIG.VIDEO_API_URL
  VIDEO_FETCH_URL: typeof CUSTOM_CONFIG.VIDEO_FETCH_URL
  fetchWithRetry: typeof CUSTOM_VIDEO_GENERATION.fetchWithRetry
  generateVideos: typeof CUSTOM_VIDEO_GENERATION.generateVideos
  VideoGenerationError: typeof CUSTOM_VIDEO_GENERATION.VideoGenerationError
  uploadVideoUrlToCDN: typeof CUSTOM_VIDEO_GENERATION.uploadVideoUrlToCDN
  types: typeof customVideoTypes
}

type VideoProvider = CustomVideoProvider

export function getVideoProvider(provider: "CUSTOM"): CustomVideoProvider
export function getVideoProvider(provider: "CUSTOM"): VideoProvider {
  switch (provider) {
    case "CUSTOM":
      return {
        apiKey: CUSTOM_CONFIG.apiKey,
        VIDEO_CONFIGS: CUSTOM_CONFIG.VIDEO_CONFIGS,
        VIDEO_API_URL: CUSTOM_CONFIG.VIDEO_API_URL,
        VIDEO_FETCH_URL: CUSTOM_CONFIG.VIDEO_FETCH_URL,
        fetchWithRetry: CUSTOM_VIDEO_GENERATION.fetchWithRetry,
        generateVideos: CUSTOM_VIDEO_GENERATION.generateVideos,
        VideoGenerationError: CUSTOM_VIDEO_GENERATION.VideoGenerationError,
        uploadVideoUrlToCDN: CUSTOM_VIDEO_GENERATION.uploadVideoUrlToCDN,
        types: customVideoTypes,
      }
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

export const customVideoTypes = {
  VideoResult: null as unknown as import("@/lib/custom/types").VideoResult,
  VideoModelConfig: null as unknown as import("@/lib/custom/types").VideoModelConfig,
  VideoGenerationResponse: null as unknown as import("@/lib/custom/types").VideoGenerationResponse,
}
