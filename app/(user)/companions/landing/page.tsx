import Link from "next/link"
import { currentUser } from "@/utils/auth"

export const metadata = {
  title: "AI Companions - Chat, Voice & Video | AdultAI",
  description: "Create your perfect AI companion. Chat naturally, hear their voice, see them talk. Build deep connections with AI that remembers you.",
}

export default async function LandingPage() {
  const user = await currentUser()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-purple-900/20 to-transparent" />
        <div className="relative max-w-6xl mx-auto px-4 py-20 text-center">
          <h1 className="text-5xl md:text-7xl font-bold mb-6 leading-tight">
            Meet Your Perfect
            <span className="block bg-gradient-to-r from-purple-400 via-pink-400 to-rose-400 bg-clip-text text-transparent">
              AI Companion
            </span>
          </h1>
          <p className="text-xl md:text-2xl text-gray-300 max-w-3xl mx-auto mb-10 leading-relaxed">
            Create AI companions that chat naturally, respond with voice & video, and remember everything about you.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Link
              href="/companions/demo"
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
            >
              Try Free Demo →
            </Link>
            <Link
              href="/companions/showcase"
              className="px-8 py-4 border-2 border-purple-500 hover:bg-purple-500/10 rounded-xl font-semibold text-lg transition-all"
            >
              Explore Companions
            </Link>
          </div>

          {/* Social Proof */}
          <div className="flex flex-wrap items-center justify-center gap-8 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>No Credit Card Required</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Free Demo Available</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>Privacy First</span>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-900/50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Why Choose AdultAI Companions?
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-purple-500/50 transition-all">
              <div className="text-5xl mb-4">💬</div>
              <h3 className="text-xl font-bold mb-3">Natural Conversations</h3>
              <p className="text-gray-400">
                Chat naturally with AI companions that understand context, remember your preferences, and respond with genuine personality.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-purple-500/50 transition-all">
              <div className="text-5xl mb-4">🎙️</div>
              <h3 className="text-xl font-bold mb-3">Voice & Video</h3>
              <p className="text-gray-400">
                Hear their voice and see them talk. Our talking avatar technology brings your companion to life with lip-synced video responses.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 hover:border-purple-500/50 transition-all">
              <div className="text-5xl mb-4">✨</div>
              <h3 className="text-xl font-bold mb-3">Fully Customizable</h3>
              <p className="text-gray-400">
                Choose their personality, appearance, and traits. Create the perfect companion that matches your unique preferences.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            Get Started in 3 Simple Steps
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-bold mb-2">Create Your Companion</h3>
              <p className="text-gray-400">
                Choose their name, personality, and appearance in our simple 4-step wizard.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-bold mb-2">Start Chatting</h3>
              <p className="text-gray-400">
                Begin your conversation. Your companion learns and remembers as you talk.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-bold mb-2">Unlock Voice & Video</h3>
              <p className="text-gray-400">
                Enable voice responses and see your companion talk with our unique video technology.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA Section */}
      <section className="py-20 bg-gradient-to-b from-transparent to-purple-900/20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6">
            Ready to Meet Your Perfect Companion?
          </h2>
          <p className="text-xl text-gray-300 mb-10">
            Try our free demo or explore the showcase. No credit card required.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/companions/demo"
              className="px-8 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-semibold text-lg transition-all shadow-lg shadow-purple-500/30 hover:shadow-purple-500/50 hover:scale-105"
            >
              Try Free Demo
            </Link>
            <Link
              href={user ? "/companions/create" : "/auth/register"}
              className="px-8 py-4 border-2 border-purple-500 hover:bg-purple-500/10 rounded-xl font-semibold text-lg transition-all"
            >
              {user ? "Create Companion" : "Sign Up Free"}
            </Link>
          </div>

          {/* Trust Indicators */}
          <div className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Secure & Private</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>AI Transparency</span>
            </div>
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10h4.764a2 2 0 011.789 2.894l-3.5 7A2 2 0 0115.263 21h-4.017c-.163 0-.326-.02-.485-.06L7 20m7-10V5a2 2 0 00-2-2h-.095c-.5 0-.905.405-.905.905 0 .714-.211 1.412-.608 2.006L7 11v9m7-10h-2M7 20H5a2 2 0 01-2-2v-6a2 2 0 012-2h2.5" />
              </svg>
              <span>Cancel Anytime</span>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
