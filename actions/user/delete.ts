
"use server";
import { db } from "@/lib/db";
import { currentUser } from "@/utils/auth";
import { z } from "zod";
import { getUserById, deleteUser as _deleteUser } from "@/utils/user";

// RAW Functions
export const deleteUserRAW = async (userId: string) => {
  const d = await _deleteUser(userId);
  if (!d) throw new Error("User deletion failed");
  return { success: true };
};

export const deleteMyAccount = async () => {
  const user = await currentUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  try {
    return await deleteUserRAW(user.id);
  } catch (error: any) {
    return { error: error.message };
  }
};
