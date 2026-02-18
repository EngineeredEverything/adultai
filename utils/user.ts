import { downloadAndUpload } from "@/lib/cdn";
import { db } from "@/lib/db";
import { User } from "next-auth";
import { Upload } from "lucide-react";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { logger } from "@/lib/logger";

/**
 * Retrieves a user by their email address.
 *
 * @param email - The email address of the user to retrieve.
 * @returns The user object if found, or `null` if not found.
 */
export const getUserByEmail = async (email: string) => {
  try {
    const user = await db.user.findUnique({ where: { email } });
    logger.info("User", { user });
    return user;
  } catch (err) {
    logger.info("err", err);
    return null;
  }
};

/**
 * Retrieves a user by their unique identifier.
 *
 * @param id - The unique identifier of the user to retrieve.
 * @returns The user object if found, or `null` if not found.
 */
export const getUserById = async (id: string) => {
  try {
    const user = await db.user.findUnique({
      where: { id },
      include: {
        preferences: {
          select: {
            currency: true,
            language: true,
          },
        },
        accounts: {
          select: {
            provider: true,
            providerAccountId: true,
          },
        }
      },
    });

    return user;
  } catch {
    return null;
  }
};

/**
 * Uploads a user image by providing a URL to the image, and registers the file with the CDN.
 *
 * @param userId - The unique identifier of the user who is uploading the image.
 * @param data - An object containing the URL of the image to upload and a boolean indicating whether the image is private.
 * @returns The uploaded image data if successful, or `null` if an error occurs.
 */

function generateRandomFilename(imageUrl: string): string {
  try {
    // Get the file extension from the original URL
    const urlObj = new URL(imageUrl);
    const originalPath = urlObj.pathname;
    const extension = path.extname(originalPath) || ".jpg"; // Default to .jpg if no extension

    // Generate UUID and append extension
    const uuid = uuidv4();
    return `${uuid}${extension}`;
  } catch (error) {
    // If URL parsing fails, use default extension
    const uuid = uuidv4();
    return `${uuid}.jpg`;
  }
}

export const createUserImageByUrl = async (
  userId: string,
  data: { url: string; private: boolean }
) => {
  try {
    const user = await getUserById(userId);
    if (!user) throw new Error("Cannot find the user");
    const filename = generateRandomFilename(data.url);
    const targetPath = `users/${filename}`; // Put files in an 'images' folder

    const upload = await downloadAndUpload(data.url, targetPath);
    if (!upload) {
      throw new Error("Something went wrong");
    }

    await db.userImage.create({
      data: {
        userId: userId,
        private: data.private,
        path: upload,
        verified: new Date(),
      },
    });
    return upload;
  } catch (error) {
    return null;
  }
};

/**
 * Retrieves a session by its token.
 *
 * @param sessionToken - The token of the session to retrieve.
 * @returns The session if found, or null if not found.
 */
export const getSessionByToken = async (sessionToken: string) => {
  try {
    const session = await db.session.findUnique({
      where: {
        sessionToken: sessionToken,
        expires: { gte: new Date() },
      },
    });
    if (!session) throw new Error("Cannot find the session");

    return session;
  } catch (error) {
    return null;
  }
};
/**
 * Retrieves a session by its unique identifier.
 *
 * @param id - The unique identifier of the session to retrieve.
 * @returns The session object if found, or `null` if not found.
 */

/**
 * Retrieves a login attempt by its unique identifier.
 *
 * @param id - The unique identifier of the login attempt to retrieve.
 * @returns The login attempt if found, or null if not found.
 */

/**
 * Retrieves a login attempt by its unique token.
 *
 * @param token - The unique token of the login attempt to retrieve.
 * @returns The login attempt object if found, or `null` if not found.
 */
export const getLoginAttemptByToken = async (token: string) => {
  try {
    const loginAttempt = await db.loginAttempt.findUnique({
      where: {
        token: token,
      },
    });
    if (!loginAttempt) throw new Error("Cannot find the login attempt");
    return loginAttempt;
  } catch (error) {
    return null;
  }
};
/**
 * Retrieves an account by the user's unique identifier.
 *
 * @param userId - The unique identifier of the user whose account to retrieve.
 * @returns The account object if found, or `null` if not found.
 */
export const getAccountByUserId = async (userId: string) => {
  try {
    const account = await db.account.findFirst({
      where: { userId },
    });

    return account;
  } catch {
    return null;
  }
};

/**
 * Retrieves an account by the provider and provider account ID.
 *
 * @param provider - The provider of the account, such as "google" or "github".
 * @param providerId - The unique identifier of the account for the given provider.
 * @returns The account object if found, or `null` if not found.
 */
export const getAccountByProvider = async (
  provider: string,
  providerId: string
) => {
  try {
    const account = await db.account.findUnique({
      where: {
        provider_providerAccountId: {
          provider,
          providerAccountId: providerId,
        },
      },
    });
    return account;
  } catch (error) {
    return null;
  }
};

/**
 * Retrieves a login attempt by the user's ID, location, and IP address.
 *
 * @param userId - The unique identifier of the user whose login attempt to retrieve.
 * @param location - The location of the login attempt.
 * @param ip - The IP address of the login attempt.
 * @returns The login attempt object if found, or `null` if not found.
 */
export const getLoginAttemptByData = async (
  userId: string,
  location: string,
  ip: string
) => {
  try {
    const loginAttempt = await db.loginAttempt.findFirst({
      where: {
        location: location,
        ip: ip,
        userId: userId,
      },
    });
    if (!loginAttempt) throw new Error("Cannot find the login attempt");
    return loginAttempt;
  } catch (error) {
    return null;
  }
};

/**
 * Deletes a user session by the provided session token.
 *
 * @param sessionToken - The session token to delete.
 * @returns The deleted session object, or `null` if the session could not be found.
 */
export const deleteSession = async (sessionToken: string) => {
  try {
    const session = await db.session.delete({
      where: {
        sessionToken: sessionToken,
      },
    });
    if (!session) throw new Error("Cannot delete the session");
    return session;
  } catch (error) {
    return null;
  }
};

/**
 * Creates a new user in the database with the provided data.
 *
 * @param data - An object containing the user data to create.
 * @param data.email - The email address of the user.
 * @param data.password - The password of the user (optional).
 * @param data.name - The name of the user.
 * @param data.emailVerified - The date the user's email was verified (optional).
 * @returns The created user object, or `null` if the creation failed.
 */
export const createUser = async (data: {
  email: string;
  password?: string;
  name: string;
  emailVerified?: Date;
}) => {
  try {
    const user = await db.user.create({
      data: {
        email: data.email,
        password: data.password,
        name: data.name,
        system: data.email === process.env.ADMIN_EMAIL,
        emailVerified: data.emailVerified,
      },
    });
    return user;
  } catch (error) {
    return null;
  }
};

/**
 * Deletes a user from the database.
 *
 * @param userId - The ID of the user to delete.
 * @returns The deleted user object, or `null` if the deletion failed.
 */
export const deleteUser = async (userId: string) => {
  try {
    const user = await db.user.delete({
      where: {
        id: userId,
      },
    });
    if (!user) throw new Error("Cannot delete the user");
    return user;
  } catch (error) {
    return null;
  }
};
