import { redirect } from "next/navigation";
import { getAgeVerification } from "./_components/verifyAge";

export default async function Home() {
  const isVerified = await getAgeVerification();
  // Verified users on homepage → send to gallery
  if (isVerified) redirect("/gallery");
  // Unverified: AgeVerificationProvider in layout shows the overlay automatically
  return null;
}
