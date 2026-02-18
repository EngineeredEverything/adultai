"use client"

import Link from "next/link"
import { Sparkles, Users, Zap } from "lucide-react"

export function CompanionFeatureBanner() {
  return (
    <div className="mb-8 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6 backdrop-blur-sm">
      <div className="flex flex-col md:flex-row items-center gap-6">
        {/* Left: Heading */}
        <div className="flex-1 text-center md:text-left">
          <div className="flex items-center gap-2 justify-center md:justify-start mb-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <h3 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              NEW: AI Companions
            </h3>
          </div>
          <p className="text-gray-400 text-sm">
            Chat with AI companions that remember you. Voice & video responses coming soon!
          </p>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            href="/companions/demo"
            className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-medium transition-all flex items-center gap-2 text-sm"
          >
            <Zap className="w-4 h-4" />
            Try Demo
          </Link>
          
          <Link
            href="/companions/showcase"
            className="px-4 py-2 border border-purple-500 hover:bg-purple-500/10 rounded-xl font-medium transition-all flex items-center gap-2 text-sm"
          >
            <Users className="w-4 h-4" />
            Explore Companions
          </Link>

          <Link
            href="/companions/create"
            className="px-4 py-2 border border-gray-700 hover:border-purple-500 rounded-xl font-medium transition-all text-sm"
          >
            Create Your Own
          </Link>
        </div>
      </div>
    </div>
  )
}
