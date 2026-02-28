"use server";

import { cache } from "react";
import { cookies } from "next/headers";
import { AGE_VERIFICATION_COOKIE, COOKIE_EXPIRY_DAYS } from "@/constants";

export async function setAgeVerification() {
    const maxAge = COOKIE_EXPIRY_DAYS * 24 * 60 * 60;
    (await cookies()).set(AGE_VERIFICATION_COOKIE, "true", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge,
    });
}

// Cached per-request — multiple calls in the same SSR pass only read cookies once
export const getAgeVerification = cache(async () => {
    return (await cookies()).has(AGE_VERIFICATION_COOKIE);
});
