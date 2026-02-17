import { getImagesCommentsInfoCORE } from "@/actions/comments/info";
import { 
  createGeneratedImage,
  createGeneratedImagesBatch,
  createSingleGeneratedImage
} from "@/actions/images/create";
import {
  getImageInfo,
  searchImagesInfoRAW,
  getImagesInfoRAW,
  searchImages
} from "@/actions/images/info";

// Base Response Types
type SearchImagesResponse = Awaited<ReturnType<typeof searchImages>>;
type CreateGeneratedImageResponse = Awaited<ReturnType<typeof createGeneratedImage>>;
type CreateGeneratedImagesBatchResponse = Awaited<ReturnType<typeof createGeneratedImagesBatch>>;
type CreateSingleGeneratedImageResponse = Awaited<ReturnType<typeof createSingleGeneratedImage>>;
type GetImageInfoResponse = Awaited<ReturnType<typeof getImageInfo>>;

// Success Type Extractions
export type SearchImagesResponseSuccessType = Extract<
  SearchImagesResponse,
  { images: Array<{ image: { id: string } }> }
>;

export type CreateGeneratedImageResponseSuccessType = Extract<
  CreateGeneratedImageResponse,
  { images: Array<{ id: string }> }
>;

export type CreateGeneratedImagesBatchResponseSuccessType = Extract<
  CreateGeneratedImagesBatchResponse,
  { images: Array<{ id: string }> }
>;

export type CreateSingleGeneratedImageResponseSuccessType = Extract<
  CreateSingleGeneratedImageResponse,
  { images: [{ id: string }] }
>;

export type GetImageInfoResponseSuccessType = Extract<
  GetImageInfoResponse,
  { image: { id: string } }
>;

// Type Guards
export function isSearchImagesResponseSuccess(
  response: SearchImagesResponse
): response is SearchImagesResponseSuccessType {
  return "images" in response && !("error" in response);
}

export function isCreateGeneratedImageResponseSuccess(
  response: CreateGeneratedImageResponse
): response is CreateGeneratedImageResponseSuccessType {
  return "images" in response && !("error" in response);
}

export function isCreateGeneratedImagesBatchResponseSuccess(
  response: CreateGeneratedImagesBatchResponse
): response is CreateGeneratedImagesBatchResponseSuccessType {
  return "images" in response && !("error" in response);
}

export function isCreateSingleGeneratedImageResponseSuccess(
  response: CreateSingleGeneratedImageResponse
): response is CreateSingleGeneratedImageResponseSuccessType {
  return "images" in response && !("error" in response) && response.images.length === 1;
}

export function isGetImageInfoResponseSuccess(
  response: GetImageInfoResponse
): response is GetImageInfoResponseSuccessType {
  return "image" in response && !("error" in response);
}

// Core Types
export type ImageComment = {
  id: string;
  comment: string;
  userId: string;
  createdAt: Date;
  user: {
    name: string | null;
  };
};


export type GeneratedImage = {
  id: string;
  prompt: string;
  imageUrl: string;
  cdnUrl: string | null;
  seed: number | null;
  modelId: string | null;
  steps: number | null;
  cfg: number | null;
  sampler: string | null;
  costNuts: number;
  token: string;
  private: boolean;
  cdnId: string;
  extension: string | null;
  size: number | null;
  name: string | null;
  verified: Date | null;
  createdAt: Date;
  updatedAt: Date;
  user: {
    name: string | null;
  };
  comments?: ImageComment[];
};

// Raw Function Result Types
export type SearchImagesRawResult = Awaited<ReturnType<typeof searchImagesInfoRAW>>;
export type GetImagesInfoRawResult = Awaited<ReturnType<typeof getImagesInfoRAW>>;
export type GetImagesCommentsResult = Awaited<ReturnType<typeof getImagesCommentsInfoCORE>>;
