"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";

function LinkDiscordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get("token");

  const [session, setSession] = useState<any>(null);
  const [authStatus, setAuthStatus] = useState<"loading" | "authenticated" | "unauthenticated">("loading");
  const [state, setState] = useState<"loading" | "ready" | "linking" | "done" | "error">("loading");
  const [message, setMessage] = useState("");

  // Fetch session without SessionProvider
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => {
        setSession(s);
        setAuthStatus(s?.user ? "authenticated" : "unauthenticated");
      })
      .catch(() => setAuthStatus("unauthenticated"));
  }, []);

  useEffect(() => {
    if (authStatus === "loading") return;
    if (!token) { setState("error"); setMessage("Invalid or missing link token."); return; }

    if (authStatus === "unauthenticated") {
      const callbackUrl = encodeURIComponent(`/auth/link-discord?token=${token}`);
      window.location.href = `/api/auth/signin?callbackUrl=${callbackUrl}`;
      return;
    }

    setState("ready");
  }, [authStatus, token]);

  const handleLink = async () => {
    setState("linking");
    try {
      const res = await fetch("/api/discord/claim-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (data.success) {
        setState("done");
        setMessage(data.message || "Your Discord has been linked to your account!");
        setTimeout(() => router.push("/gallery/user"), 2500);
      } else {
        setState("error");
        setMessage(data.error || "Something went wrong.");
      }
    } catch {
      setState("error");
      setMessage("Failed to connect. Please try again.");
    }
  };

  if (state === "loading") {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl p-8 max-w-md w-full text-center">
        <div className="w-16 h-16 bg-[#5865F2] rounded-full flex items-center justify-center mx-auto mb-6">
          <span className="text-white text-2xl font-bold">D</span>
        </div>

        {state === "ready" && (
          <>
            <h1 className="text-2xl font-bold text-white mb-2">Link Discord to AdultAI</h1>
            <p className="text-gray-400 mb-2">
              Signed in as <span className="text-white font-medium">{session?.user?.email}</span>
            </p>
            <p className="text-gray-400 mb-6 text-sm">
              This will link your Discord account to your existing profile. Any images saved from Discord will appear in your gallery.
            </p>
            <button
              onClick={handleLink}
              className="w-full bg-[#5865F2] hover:bg-[#4752c4] text-white font-semibold py-3 px-6 rounded-xl transition-colors"
            >
              Link Discord Account
            </button>
            <p className="text-gray-500 text-xs mt-4">
              Not you?{" "}
              <button
                onClick={() => {
                  const callbackUrl = encodeURIComponent(`/auth/link-discord?token=${token}`);
                  window.location.href = `/api/auth/signin?callbackUrl=${callbackUrl}`;
                }}
                className="text-purple-400 hover:underline"
              >
                Sign in with a different account
              </button>
            </p>
          </>
        )}

        {state === "linking" && (
          <>
            <h1 className="text-2xl font-bold text-white mb-4">Linking...</h1>
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto" />
          </>
        )}

        {state === "done" && (
          <>
            <div className="text-5xl mb-4">✅</div>
            <h1 className="text-2xl font-bold text-white mb-2">Linked!</h1>
            <p className="text-gray-400">{message}</p>
            <p className="text-gray-500 text-sm mt-2">Redirecting to your gallery...</p>
          </>
        )}

        {state === "error" && (
          <>
            <div className="text-5xl mb-4">❌</div>
            <h1 className="text-2xl font-bold text-white mb-2">Something went wrong</h1>
            <p className="text-gray-400 mb-4">{message}</p>
            <button onClick={() => router.push("/gallery/user")} className="text-purple-400 hover:underline text-sm">
              Go to gallery anyway
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LinkDiscordPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LinkDiscordContent />
    </Suspense>
  );
}
