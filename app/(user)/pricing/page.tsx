export const dynamic = "force-dynamic";
import { Metadata } from "next"
import { WaitlistForm } from "./WaitlistForm"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Pricing - AdultAI",
  description: "Choose your AdultAI plan. Unlimited AI companions, voice chat, and talking avatars.",
}

const plans = [
  {
    name: "Free",
    price: "$0",
    period: "",
    description: "Get started with AdultAI",
    features: [
      "5 image generations / day",
      "Public gallery access",
      "Demo chat (limited)",
      "No account required",
    ],
    cta: "Start Free",
    href: "/gallery",
    highlight: false,
  },
  {
    name: "Premium",
    price: "$15",
    period: "/mo",
    description: "Full companion experience",
    features: [
      "Unlimited image generations",
      "3 custom AI companions",
      "Voice chat & STT",
      "Talking avatar videos",
      "Companion memory (remembers you)",
      "26 pre-built companions",
      "Priority GPU queue",
    ],
    cta: "Join Waitlist",
    href: "/checkout",
    highlight: true,
    badge: "Most Popular",
  },
  {
    name: "Ultimate",
    price: "$30",
    period: "/mo",
    description: "For serious users",
    features: [
      "Everything in Premium",
      "Unlimited companions",
      "HD image generation",
      "Video generation (5-10s clips)",
      "Custom voice cloning",
      "Early access to new features",
      "Discord VIP role",
    ],
    cta: "Join Waitlist",
    href: "/checkout",
    highlight: false,
  },
]

const comparisons = [
  { feature: "AI Companions", free: "Demo only", premium: "3 custom", ultimate: "Unlimited" },
  { feature: "Voice Chat", free: "—", premium: "✓", ultimate: "✓" },
  { feature: "Talking Avatars", free: "—", premium: "✓", ultimate: "✓" },
  { feature: "Companion Memory", free: "—", premium: "✓", ultimate: "✓" },
  { feature: "Image Generations", free: "5/day", premium: "Unlimited", ultimate: "Unlimited HD" },
  { feature: "Video Generation", free: "—", premium: "—", ultimate: "✓" },
  { feature: "GPU Priority", free: "—", premium: "High", ultimate: "Highest" },
]

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-16">

        {/* Header */}
        <div className="text-center mb-14">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Simple,{" "}
            <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              honest pricing
            </span>
          </h1>
          <p className="text-gray-400 text-lg max-w-xl mx-auto">
            No hidden fees. Cancel anytime. Payment processing launching soon — join the waitlist for early access.
          </p>
          <div className="mt-4 inline-flex items-center gap-2 bg-purple-500/10 border border-purple-500/20 rounded-full px-4 py-2 text-sm text-purple-300">
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
            Waitlist open — launching soon with CCBill / Segpay
          </div>
        </div>

        {/* Waitlist capture */}
        <div className="max-w-xl mx-auto mb-14 bg-gray-900/60 border border-purple-500/20 rounded-2xl p-6 text-center">
          <p className="text-white font-semibold mb-1">🚀 Get early access + launch discount</p>
          <p className="text-gray-400 text-sm mb-4">Be first when payments go live. No spam, unsubscribe anytime.</p>
          <WaitlistForm />
        </div>

        {/* Plans */}
        <div className="grid sm:grid-cols-3 gap-6 mb-16">
          {plans.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl p-6 flex flex-col ${
                plan.highlight
                  ? "bg-gradient-to-b from-purple-900/40 to-pink-900/20 border-2 border-purple-500/50 shadow-xl shadow-purple-500/10"
                  : "bg-gray-900/60 border border-gray-800"
              }`}
            >
              {plan.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                  {plan.badge}
                </div>
              )}

              <div className="mb-5">
                <h2 className="text-lg font-bold text-white mb-1">{plan.name}</h2>
                <div className="flex items-baseline gap-1 mb-1">
                  <span className="text-4xl font-bold text-white">{plan.price}</span>
                  {plan.period && <span className="text-gray-400">{plan.period}</span>}
                </div>
                <p className="text-sm text-gray-400">{plan.description}</p>
              </div>

              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-gray-300">
                    <span className="text-purple-400 mt-0.5 flex-shrink-0">✓</span>
                    {f}
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={`block text-center py-3 rounded-xl font-semibold text-sm transition-all duration-200 ${
                  plan.highlight
                    ? "bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white shadow-lg shadow-purple-500/30"
                    : "bg-gray-800 hover:bg-gray-700 text-white border border-gray-700"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>

        {/* Comparison table */}
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl overflow-hidden mb-12">
          <div className="p-6 border-b border-gray-800">
            <h3 className="text-lg font-bold">Feature Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-6 py-3 text-gray-400 font-normal">Feature</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-normal">Free</th>
                  <th className="text-center px-4 py-3 text-purple-400 font-semibold">Premium</th>
                  <th className="text-center px-4 py-3 text-gray-400 font-normal">Ultimate</th>
                </tr>
              </thead>
              <tbody>
                {comparisons.map((row, i) => (
                  <tr key={row.feature} className={i < comparisons.length - 1 ? "border-b border-gray-800/50" : ""}>
                    <td className="px-6 py-3 text-gray-300">{row.feature}</td>
                    <td className="px-4 py-3 text-center text-gray-500">{row.free}</td>
                    <td className="px-4 py-3 text-center text-purple-300">{row.premium}</td>
                    <td className="px-4 py-3 text-center text-gray-300">{row.ultimate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FAQ */}
        <div className="max-w-2xl mx-auto">
          <h3 className="text-2xl font-bold mb-6 text-center">Common Questions</h3>
          <div className="space-y-4">
            {[
              {
                q: "Is all content AI-generated?",
                a: "Yes. 100% synthetic. No real people, no real likenesses — only AI-generated fictional characters."
              },
              {
                q: "When does billing launch?",
                a: "We're onboarding with CCBill and Segpay — industry-standard adult payment processors. Joining the waitlist gets you early access and a launch discount."
              },
              {
                q: "What makes companions different from chatbots?",
                a: "Our companions have persistent memory (they remember past conversations), unique AI-generated portraits, ElevenLabs voice, and real-time talking avatar videos. It's a relationship, not a chat session."
              },
              {
                q: "Can I cancel anytime?",
                a: "Yes. No contracts, no cancellation fees. Cancel from your account settings and you won't be charged again."
              },
            ].map((item) => (
              <div key={item.q} className="bg-gray-900/60 border border-gray-800 rounded-xl p-5">
                <h4 className="font-semibold text-white mb-2">{item.q}</h4>
                <p className="text-gray-400 text-sm leading-relaxed">{item.a}</p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-14 text-center">
          <p className="text-gray-400 mb-4">Ready to meet your companion?</p>
          <div className="flex justify-center gap-3 flex-wrap">
            <Link
              href="/companions/demo"
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold transition-all duration-200 shadow-lg shadow-purple-500/30"
            >
              Try Demo Free
            </Link>
            <Link
              href="/companions/showcase"
              className="px-6 py-3 rounded-xl bg-gray-800 hover:bg-gray-700 text-white font-semibold transition-colors border border-gray-700"
            >
              Browse Companions
            </Link>
          </div>
        </div>

      </div>
    </div>
  )
}
