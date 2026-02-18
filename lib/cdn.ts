// "use server";
import axios from "axios";
import path from "path";
import { logger } from "@/lib/logger";

// Type definitions
interface BunnyConfig {
  storageHost: string;
  storageZone: string;
  apiKey: string;
  cdnUrl: string;
}

// Load config from environment variables
const bunnyConfig: BunnyConfig = {
  storageHost: process.env.BUNNY_STORAGE_HOST || "",
  storageZone: process.env.BUNNY_STORAGE_ZONE || "",
  apiKey: process.env.BUNNY_API_KEY || "",
  cdnUrl: process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "",
};

/**
 * Downloads a file from a URL and uploads it to Bunny.net storage
 */
export async function downloadAndUpload(
  sourceUrl: string,
  remoteFilePath: string
): Promise<string> {
  try {
    // Download the file
    logger.info(`Downloading file from: ${sourceUrl}`);
    const response = await axios.get(sourceUrl, {
      responseType: "arraybuffer",
    });

    // Get file extension from URL or use default
    const urlPath = new URL(sourceUrl).pathname;
    const fileExtension = path.extname(urlPath) || ".bin";

    // Create temp filename if not provided
    if (!remoteFilePath) {
      const fileName =
        path.basename(urlPath) || `file-${Date.now()}${fileExtension}`;
      remoteFilePath = fileName;
    }

    // Determine content type (basic implementation)
    let contentType = "application/octet-stream";
    if (response.headers["content-type"]) {
      contentType = response.headers["content-type"];
    }

    // Upload to Bunny.net
    await axios.put(
      `https://${bunnyConfig.storageHost}/${bunnyConfig.storageZone}/${remoteFilePath}`,
      response.data,
      {
        headers: {
          AccessKey: bunnyConfig.apiKey,
          "Content-Type": contentType,
        },
      }
    );

    const cdnUrl = `${bunnyConfig.cdnUrl}/${remoteFilePath}`;
    logger.info(
      `File downloaded and uploaded successfully. CDN URL: ${cdnUrl}`
    );
    return cdnUrl;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        "Error in download and upload:",
        error.response?.data || error.message
      );
    } else {
      logger.error("Error in download and upload:", error);
    }
    throw error;
  }
}

/**
 * Deletes a file from Bunny.net storage
 */
export async function deleteFile(remoteFilePath: string): Promise<void> {
  try {
    await axios.delete(
      `https://${bunnyConfig.storageHost}/${bunnyConfig.storageZone}/${remoteFilePath}`,
      {
        headers: {
          AccessKey: bunnyConfig.apiKey,
        },
      }
    );

    logger.info(`File deleted successfully: ${remoteFilePath}`);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        "Error deleting file:",
        error.response?.data || error.message
      );
    } else {
      logger.error("Error deleting file:", error);
    }
    throw error;
  }
}

/**
 * Generates a batch of file links on the CDN.
 *
 * @param fileIds - An array of file IDs to generate links for.
 * @returns An array of objects containing the file ID and generated link.
 */
export const generateLinksBatch =  (
  images: { id: string; path: string }[]
): { id: string; link: string }[] => {
  return images.map((image) => ({
    id: image.id,
    link: `${bunnyConfig.cdnUrl}/${image.path}`,
  }));
};


/**
 * Uploads a base64 encoded image to the Bunny CDN
 * @param base64Image The base64 encoded image (without data URL prefix)
 * @param targetPath The target path on CDN
 * @returns The CDN URL
 */
export async function uploadBase64ToCdn(
  base64Image: string,
  targetPath: string
): Promise<string> {
  try {
    logger.info(`Uploading base64 image to path: ${targetPath}`);
    
    // Extract the base64 data if it includes the data URL prefix
    let cleanBase64 = base64Image;
    if (base64Image.includes(';base64,')) {
      cleanBase64 = base64Image.split(';base64,')[1];
    }
    
    // Convert base64 to binary buffer
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    
    // Determine content type based on the file extension
    const fileExtension = path.extname(targetPath).toLowerCase();
    let contentType = 'image/png'; // Default
    
    // Set the appropriate content type based on file extension
    if (fileExtension === '.jpg' || fileExtension === '.jpeg') {
      contentType = 'image/jpeg';
    } else if (fileExtension === '.gif') {
      contentType = 'image/gif';
    } else if (fileExtension === '.webp') {
      contentType = 'image/webp';
    }
    
    // Upload to Bunny.net
    await axios.put(
      `https://${bunnyConfig.storageHost}/${bunnyConfig.storageZone}/${targetPath}`,
      imageBuffer,
      {
        headers: {
          AccessKey: bunnyConfig.apiKey,
          'Content-Type': contentType,
        },
      }
    );

    const cdnUrl = `${bunnyConfig.cdnUrl}/${targetPath}`;
    logger.info(
      `Base64 image uploaded successfully. CDN URL: ${cdnUrl}`
    );
    return cdnUrl;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      logger.error(
        "Error uploading base64 image:",
        error.response?.data || error.message
      );
    } else {
      logger.error("Error uploading base64 image:", error);
    }
    throw error;
  }
}
