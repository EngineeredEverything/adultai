import { redirect } from "next/navigation";
import { AgeVerification } from "./_components/age-verification";
import { getAgeVerification } from "./_components/verifyAge";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const isVerified = await getAgeVerification();
  const callbackUrl = (await searchParams)?.callbackUrl || "/gallery";

  if (isVerified) {
    redirect(callbackUrl);
  }

  return (
    <div className="min-h-screen bg-black">
      <AgeVerification callbackUrl={callbackUrl} />
    </div>
  );
}
