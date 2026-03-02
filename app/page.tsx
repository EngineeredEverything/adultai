import { redirect } from "next/navigation";

// Always send root / → /gallery
// AgeVerificationProvider in layout handles the age gate overlay client-side
// No cookie read here — avoids blocking server round-trip on every homepage visit
export default function Home() {
  redirect("/gallery");
}
