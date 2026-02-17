import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import jwt from "jsonwebtoken";
import { db } from "@/lib/db";


/**
 * Retrieves a verification token by the provided token string.
 *
 * @param token - The token string to search for.
 * @returns The verification token if found, otherwise `null`.
 */
export const getVerificationTokenByToken = async (
  token: string
) => {
  try {
    const verificationToken = await db.verificationToken.findUnique({
      where: { token }
    });

    return verificationToken;
  } catch {
    return null;
  }
}

/**
 * Retrieves a verification token by the provided email address.
 *
 * @param email - The email address associated with the verification token.
 * @returns The verification token if found, or `null` if not found.
 */
export const getVerificationTokenByEmail = async (
  email: string
) => {
  try {
    const verificationToken = await db.verificationToken.findFirst({
      where: { email }
    });

    return verificationToken;
  } catch {
    return null;
  }
}

/**
 * Retrieves a two-factor authentication token by the provided token string.
 *
 * @param token - The token string to search for.
 * @returns The two-factor authentication token if found, otherwise `null`.
 */
export const getTwoFactorTokenByToken = async (token: string) => {
  try {
    const twoFactorToken = await db.twoFactorToken.findUnique({
      where: { token }
    });

    return twoFactorToken;
  } catch {
    return null;
  }
};

/**
 * Retrieves a two-factor authentication token by the associated email address.
 *
 * @param email - The email address associated with the two-factor authentication token.
 * @returns The two-factor authentication token, or `null` if not found.
 */
export const getTwoFactorTokenByEmail = async (email: string) => {
  try {
    const twoFactorToken = await db.twoFactorToken.findFirst({
      where: { email }
    });

    return twoFactorToken;
  } catch {
    return null;
  }
};



/**
 * Retrieves a password reset token by its token value.
 *
 * @param token - The token value to search for.
 * @returns The password reset token if found, or `null` if not found.
 */
export const getPasswordResetTokenByToken = async (token: string) => {
  try {
    const passwordResetToken = await db.passwordResetToken.findUnique({
      where: { token }
    });

    return passwordResetToken;
  } catch {
    return null;
  }
};

/**
 * Retrieves a password reset token by its token value.
 *
 * @param token - The token value to search for.
 * @returns The password reset token if found, or `null` if not found.
 */
export const getPasswordResetTokenByEmail = async (email: string) => {
  try {
    const passwordResetToken = await db.passwordResetToken.findFirst({
      where: { email }
    });

    return passwordResetToken;
  } catch {
    return null;
  }
};


/**
 * Retrieves a password reset OTP by its OTP value.
 *
 * @param otp - The OTP value to search for.
 * @returns The password reset OTP if found, or `null` if not found.
 */
export const getPasswordResetOTPByOtp = async (otp: string) => {
  try {
    const passwordResetOTP = await db.oTPConfirmation.findFirst({
      where: { otp }
    });

    return passwordResetOTP;
  } catch {
    return null;
  }
};


/**
 * Retrieves a verification OTP token for the given email address.
 *
 * @param email - The email address to get the verification OTP for.
 * @returns The verification OTP token if found, null otherwise.
 */
export const getVerificationOtpByEmail = async (email: string) => {
  try {
    const verificationToken = await db.oTPConfirmation.findFirst({
      where: {
        email,
      },
    });

    return verificationToken;
  } catch {
    return null;
  }
};


/**
 * Retrieves the two-factor confirmation record for the specified user ID.
 *
 * @param userId - The ID of the user to retrieve the two-factor confirmation record for.
 * @returns The two-factor confirmation record for the specified user, or `null` if not found.
 */
export const getTwoFactorConfirmationByUserId = async (
  userId: string
) => {
  try {
    const twoFactorConfirmation = await db.twoFactorConfirmation.findUnique({
      where: { userId }
    });

    return twoFactorConfirmation;
  } catch {
    return null;
  }
};

/**
 * Generates a new two-factor authentication token for the given email address.
 *
 * If an existing token is found for the email, it is first deleted before creating a new one.
 *
 * @param email - The email address to generate the token for.
 * @returns The newly created two-factor authentication token.
 */
export const generateTwoFactorToken = async (email: string) => {
  const token = crypto.randomInt(100_000, 1_000_000).toString();
  const expires = new Date(new Date().getTime() + 5 * 60 * 1000);

  const existingToken = await getTwoFactorTokenByEmail(email);

  if (existingToken) {
    await db.twoFactorToken.delete({
      where: {
        id: existingToken.id,
      },
    });
  }

  const twoFactorToken = await db.twoFactorToken.create({
    data: {
      email,
      token,
      expires,
    },
  });

  return twoFactorToken;
};
/**
 * Generates a new token with a unique identifier and a specified expiration time.
 *
 * @param modelName - The name of the model to associate the token with.
 * @param fieldName - The name of the field in the model to store the token.
 * @param maxRetries - The maximum number of attempts to generate a unique token.
 * @returns A new token string.
 */
export const generateToken = async (
  modelName: string,
  fieldName: string,
  maxRetries = 5
) => {
  let token;
  let existingRecord;
  for (let i = 0; i < maxRetries; i++) {
    token = jwt.sign(
      { id: crypto.randomUUID() + Date.now() },
      process.env.APP_SECRET as string
    );
    existingRecord = await (db as any)[modelName].findFirst({
      where: { [fieldName]: token },
    });
    if (!existingRecord) break;
  }
  if (!token) throw new Error("Could not generate token");
  return token;
};

/**
 * Generates a new password reset token for the specified email address.
 *
 * @param email - The email address to generate the password reset token for.
 * @returns A new password reset token object.
 */
export const generatePasswordResetToken = async (email: string) => {
  const token = uuidv4();
  const expires = new Date(new Date().getTime() + 3600 * 1000);

  const existingToken = await getPasswordResetTokenByEmail(email);

  if (existingToken) {
    await db.passwordResetToken.delete({
      where: { id: existingToken.id },
    });
  }

  const passwordResetToken = await db.passwordResetToken.create({
    data: {
      email,
      token,
      expires,
    },
  });

  return passwordResetToken;
};

/**
 * Generates a new email verification token for the given email address.
 *
 * @param email - The email address to generate the verification token for.
 * @returns A new verification token object containing the token string and its expiration date.
 */
export const generateVerificationToken = async (email: string) => {
  const token = uuidv4();
  const expires = new Date(new Date().getTime() + 3600 * 1000);

  const existingToken = await getVerificationTokenByEmail(email);

  if (existingToken) {
    await db.verificationToken.delete({
      where: {
        id: existingToken.id,
      },
    });
  }

  const verificationToken = await db.verificationToken.create({
    data: {
      email,
      token,
      expires,
    },
  });

  return verificationToken;
};

export default function generateOTP(length: number = 6): string {
  if (length <= 0) {
    throw new Error("OTP length must be greater than 0");
  }

  // Generate a random numeric OTP
  const digits = "0123456789";
  let otp = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * digits.length);
    otp += digits[randomIndex];
  }

  return otp;
}




// Function to generate 6-digit code from UUID
/**
 * Generates a 6-digit code from a UUID token.
 *
 * This function takes a UUID string, removes the hyphens, and extracts the first 6 characters of the hexadecimal representation. It then converts the hexadecimal value to a decimal number and ensures the result is a 6-digit string by using modulo and padding.
 *
 * @param uuid - The UUID token to generate the 6-digit code from.
 * @returns A 6-digit code generated from the UUID token.
 */
export const generateFourDigitCodeToken = async (email: string) => {
  const expires = new Date(new Date().getTime() + 3600 * 1000);
 const otp =  generateOTP(4)
  const existingToken = await getVerificationOtpByEmail(email);

  if (existingToken) {
    await db.oTPConfirmation.delete({
      where: {
        id: existingToken.id,
      },
    });
  }

  const verificationToken = await db.oTPConfirmation.create({
    data: {
      email,
      otp,
      expires,
    },
  });

  return verificationToken;
};
