import { downloadAndUpload } from "@/lib/cdn";
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { logger } from "@/lib/logger";

const DEBUG = true; // Set to false to disable debugging

const logDebug = (...args: any[]) => {
  if (DEBUG) logger.info("[DEBUG]", ...args);
};

/**
 * Generates a random filename with the correct extension from the original URL
 */
function generateRandomFilename(imageUrl: string): string {
  try {
    // Get the file extension from the original URL
    const urlObj = new URL(imageUrl);
    const originalPath = urlObj.pathname;
    const extension = path.extname(originalPath) || '.jpg'; // Default to .jpg if no extension
    
    // Generate UUID and append extension
    const uuid = uuidv4();
    return `${uuid}${extension}`;
  } catch (error) {
    // If URL parsing fails, use default extension
    const uuid = uuidv4();
    return `${uuid}.jpg`;
  }
}

/**
 * Downloads an image and uploads it directly to the CDN.
 *
 * @param imageUrl - The URL of the image to download and upload.
 * @returns The uploaded file data, or `null` if the upload failed.
 */
export async function uploadImageDirect(imageUrl: string) {
  try {
    logDebug(`Downloading image from: ${imageUrl}`);
    
    // Validate the URL
    const response = await fetch(imageUrl, { method: 'HEAD' });
    if (!response.ok) {
      throw new Error(`Failed to validate image URL: ${response.statusText}`);
    }
    
    // Generate a random filename with proper extension
    const filename = generateRandomFilename(imageUrl);
    const targetPath = `images/${filename}`; // Put files in an 'images' folder
    
    logDebug(`Generated target path: ${targetPath}`);
    
    // Download and upload to CDN
    logDebug("Uploading image to CDN...");
    const link = await downloadAndUpload(imageUrl, targetPath);
    
    logDebug(`Successfully uploaded. CDN URL: ${link}`);
    
    return { 
      link, 
      path: targetPath, 
      originalUrl: imageUrl,
      filename
    };
  } catch (error) {
    logger.error("Upload error:", error);
    return null;
  }
}