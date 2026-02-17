"use server";

import { db } from "@/lib/db";
import { currentUser } from "@/utils/auth";
import { z } from "zod";
// import {
//   createUserCombinedSchema,
//   createUserImageSchema,
//   createUserSchema,
// } from "@/schemas/user";
import { User } from "next-auth";
import { generateLinksBatch, downloadAndUpload } from "@/lib/cdn";
import { getUserById, createUser as _createUser } from "@/utils/user";
import bcrypt from "bcryptjs";

// Helper function to generate a unique file path
const generateUniquePath = (fileName: string, userId: string) => {
  const timestamp = Date.now();
  const extension = fileName.split(".").pop();
  return `users/${userId}/${timestamp}-${Math.random()
    .toString(36)
    .substring(7)}.${extension}`;
};
