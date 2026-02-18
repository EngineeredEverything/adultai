"use client"

import { useState } from "react"
import Link from "next/link"

export default function QuickActions() {
  const [isOpen, setIsOpen] = useState(false)

  const actions = [
    {
      label: "New Companion",
      href: "/companions/create",
      icon: "M12 4v16m8-8H4",
      color: "from-purple-600 to-pink-600",
      hotkey: "C",
    },
    {
      label: "Generate Image",
      href: "/advanced-generate",
      icon: "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
      color: "from-blue-600 to-cyan-600",
      hotkey: "I",
    },
    {
      label: "Video Gallery",
      href: "/video-gallery",
      icon: "M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z",
      color: "from-red-600 to-pink-600",
      hotkey: "V",
    },
    {
      label: "My Companions",
      href: "/companions",
      icon: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
      color: "from-purple-600 to-indigo-600",
      hotkey: "M",
    },
  ]

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 z-40 w-14 h-14 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-full shadow-lg shadow-purple-500/30 flex items-center justify-center transition-all duration-300 hover:scale-110 group"
        aria-label="Quick actions"
      >
        {isOpen ? (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        )}
      </button>

      {/* Quick Actions Menu */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30"
            onClick={() => setIsOpen(false)}
          />

          {/* Menu */}
          <div className="fixed bottom-24 right-6 z-40 bg-gray-900 border border-gray-800 rounded-2xl shadow-xl shadow-black/50 p-3 min-w-[240px] animate-in fade-in slide-in-from-bottom-2 duration-200">
            <div className="space-y-1">
              {actions.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setIsOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-gray-800 transition-all duration-200 group"
                >
                  <div className={`w-10 h-10 bg-gradient-to-r ${action.color} rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform`}>
                    <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={action.icon} />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-white">{action.label}</div>
                  </div>
                  <kbd className="hidden sm:inline-block px-2 py-1 text-xs font-mono bg-gray-800 border border-gray-700 rounded">
                    {action.hotkey}
                  </kbd>
                </Link>
              ))}
            </div>

            {/* Hint */}
            <div className="mt-3 pt-3 border-t border-gray-800 px-4">
              <p className="text-xs text-gray-500 text-center">
                Press <kbd className="px-1 py-0.5 bg-gray-800 border border-gray-700 rounded text-[10px]">?</kbd> for keyboard shortcuts
              </p>
            </div>
          </div>
        </>
      )}
    </>
  )
}
