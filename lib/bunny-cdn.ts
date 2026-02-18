/**
 * Bunny CDN Upload Utilities
 */

const BUNNY_API_KEY = process.env.BUNNY_API_KEY || process.env.BUNNY_API_KEY2
const BUNNY_CDN_URL = process.env.NEXT_PUBLIC_BUNNY_CDN_URL || "https://adultai-com.b-cdn.net"
const BUNNY_STORAGE_ZONE = "adultai-com" // Storage zone name
const BUNNY_STORAGE_API = "https://storage.bunnycdn.com"

export interface UploadOptions {
  folder?: string
  filename?: string
  contentType?: string
}

/**
 * Upload a file buffer to Bunny CDN
 * @param buffer File buffer to upload
 * @param options Upload options (folder, filename, contentType)
 * @returns Public CDN URL of uploaded file
 */
export async function uploadToBunnyCDN(
  buffer: Buffer,
  options: UploadOptions = {}
): Promise<string> {
  if (!BUNNY_API_KEY) {
    throw new Error("BUNNY_API_KEY not configured")
  }

  const {
    folder = "uploads",
    filename = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    contentType = "application/octet-stream",
  } = options

  // Construct storage path
  const storagePath = `/${BUNNY_STORAGE_ZONE}/${folder}/${filename}`
  const uploadUrl = `${BUNNY_STORAGE_API}${storagePath}`

  try {
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "AccessKey": BUNNY_API_KEY,
        "Content-Type": contentType,
      },
      body: buffer,
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Bunny CDN upload failed: ${response.status} ${errorText}`)
    }

    // Return public CDN URL
    const publicUrl = `${BUNNY_CDN_URL}/${folder}/${filename}`
    return publicUrl
  } catch (error: any) {
    console.error("Bunny CDN upload error:", error)
    throw error
  }
}

/**
 * Upload audio file to Bunny CDN
 * @param buffer Audio buffer (MP3, WAV, etc.)
 * @param extension File extension (default: mp3)
 * @returns Public CDN URL
 */
export async function uploadAudio(buffer: Buffer, extension = "mp3"): Promise<string> {
  const filename = `audio_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`
  
  return uploadToBunnyCDN(buffer, {
    folder: "audio",
    filename,
    contentType: `audio/${extension}`,
  })
}

/**
 * Upload video file to Bunny CDN
 * @param buffer Video buffer (MP4, WEBM, etc.)
 * @param extension File extension (default: mp4)
 * @returns Public CDN URL
 */
export async function uploadVideo(buffer: Buffer, extension = "mp4"): Promise<string> {
  const filename = `video_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`
  
  return uploadToBunnyCDN(buffer, {
    folder: "videos",
    filename,
    contentType: `video/${extension}`,
  })
}

/**
 * Upload image file to Bunny CDN
 * @param buffer Image buffer (JPG, PNG, etc.)
 * @param extension File extension (default: jpg)
 * @returns Public CDN URL
 */
export async function uploadImage(buffer: Buffer, extension = "jpg"): Promise<string> {
  const filename = `image_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extension}`
  
  return uploadToBunnyCDN(buffer, {
    folder: "images",
    filename,
    contentType: `image/${extension}`,
  })
}

/**
 * Delete a file from Bunny CDN
 * @param fileUrl Full CDN URL of the file to delete
 * @returns true if successful
 */
export async function deleteFromBunnyCDN(fileUrl: string): Promise<boolean> {
  if (!BUNNY_API_KEY) {
    throw new Error("BUNNY_API_KEY not configured")
  }

  try {
    // Extract path from CDN URL
    const url = new URL(fileUrl)
    const pathParts = url.pathname.split("/").filter(Boolean)
    const storagePath = `/${BUNNY_STORAGE_ZONE}/${pathParts.join("/")}`
    const deleteUrl = `${BUNNY_STORAGE_API}${storagePath}`

    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: {
        "AccessKey": BUNNY_API_KEY,
      },
    })

    return response.ok
  } catch (error: any) {
    console.error("Bunny CDN delete error:", error)
    return false
  }
}
