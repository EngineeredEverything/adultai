"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { User } from "next-auth"
import { GetPlanInfoSuccessType } from "@/types/subscriptions"

export default function StripeCheckout({
  user,
  plan,
  planId,
  billing,
}: {
  user: User
  plan: GetPlanInfoSuccessType
  planId: string
  billing: "monthly" | "yearly"
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const price = billing === "monthly" ? plan.plan.monthlyPrice : plan.plan.yearlyPrice

  const handleCheckout = async () => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/stripe/create-checkout-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId, billing }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Failed to create checkout session")
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error("No checkout URL returned")
      }
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="max-w-lg w-full">
        {/* Plan Summary Card */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 mb-6">
          <h2 className="text-2xl font-bold mb-4">{plan.plan.name}</h2>
          {plan.plan.description && (
            <p className="text-gray-400 mb-6">{plan.plan.description}</p>
          )}

          <div className="space-y-3 mb-6">
            <div className="flex justify-between items-baseline">
              <span className="text-gray-400">Billing</span>
              <span className="capitalize font-medium">{billing}</span>
            </div>
            <div className="flex justify-between items-baseline">
              <span className="text-gray-400">Amount</span>
              <span className="text-3xl font-bold">
                ${((price || 0) / 100).toFixed(2)}
                <span className="text-lg text-gray-400">
                  /{billing === "monthly" ? "mo" : "yr"}
                </span>
              </span>
            </div>
          </div>

          {/* Features */}
          {plan.plan.nutsPerMonth !== -1 && (
            <div className="border-t border-gray-800 pt-4 space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{plan.plan.nutsPerMonth === -1 ? "Unlimited" : plan.plan.nutsPerMonth} credits/month</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{plan.plan.imagesPerDay === -1 ? "Unlimited" : plan.plan.imagesPerDay} images/day</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <svg className="w-5 h-5 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>Up to {plan.plan.imagesPerGeneration} images per generation</span>
              </div>
            </div>
          )}
        </div>

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Checkout Button */}
        <button
          onClick={handleCheckout}
          disabled={loading}
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed py-4 rounded-xl font-semibold text-lg transition-all duration-200 flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Creating checkout session...
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              Continue to Payment
            </>
          )}
        </button>

        {/* Security Notice */}
        <p className="text-center text-gray-500 text-xs mt-4">
          🔒 Secure payment powered by Stripe. Your payment information is never stored on our servers.
        </p>

        {/* Cancel Link */}
        <button
          onClick={() => router.push("/subscription")}
          className="w-full text-gray-400 hover:text-white text-sm mt-4 transition-colors"
        >
          ← Back to subscription plans
        </button>
      </div>
    </div>
  )
}
