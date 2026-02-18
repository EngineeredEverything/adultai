import bcrypt from "bcryptjs";

/**
 * Hashes the provided password using bcrypt.
 * @param password - The password to be hashed.
 * @returns The hashed password.
 */
export const hash = async (password: string) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  return hashedPassword;
};
