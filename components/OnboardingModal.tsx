"use client"

import { useState, useEffect } from "react"
import Link from "next/link"

interface OnboardingModalProps {
  isFirstVisit?: boolean
}

export default function OnboardingModal({ isFirstVisit = false }: OnboardingModalProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)

  useEffect(() => {
    // Check if user has seen onboarding
    const hasSeenOnboarding = localStorage.getItem("hasSeenOnboarding")
    if (!hasSeenOnboarding && isFirstVisit) {
      setIsOpen(true)
    }
  }, [isFirstVisit])

  const steps = [
    {
      title: "Welcome to AdultAI! 👋",
      description: "Create AI companions that remember you, chat naturally, and respond with voice & video.",
      icon: "💫",
    },
    {
      title: "Build Your Perfect Companion",
      description: "Choose their personality, appearance style, and customize every detail to match your preferences.",
      icon: "✨",
    },
    {
      title: "Chat With Depth",
      description: "Your companions remember every conversation and grow with you over time. Enable voice & video for a truly immersive experience.",
      icon: "💬",
    },
    {
      title: "Try It Risk-Free",
      description: "Start with our free demo to see what's possible. No credit card required.",
      icon: "🎭",
    },
  ]

  const handleClose = () => {
    localStorage.setItem("hasSeenOnboarding", "true")
    setIsOpen(false)
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleClose()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  if (!isOpen) return null

  const step = steps[currentStep]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl max-w-lg w-full p-8 relative">
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition"
        >
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Progress dots */}
        <div className="flex gap-2 justify-center mb-6">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                index === currentStep
                  ? "w-8 bg-gradient-to-r from-purple-500 to-pink-500"
                  : index < currentStep
                  ? "w-4 bg-purple-500/50"
                  : "w-4 bg-gray-700"
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{step.icon}</div>
          <h2 className="text-2xl font-bold mb-3 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            {step.title}
          </h2>
          <p className="text-gray-400 leading-relaxed">
            {step.description}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          {currentStep > 0 && (
            <button
              onClick={handlePrev}
              className="flex-1 px-6 py-3 border border-gray-700 hover:border-gray-600 rounded-xl font-medium transition-all"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-medium transition-all"
          >
            {currentStep < steps.length - 1 ? "Next" : "Get Started"}
          </button>
        </div>

        {/* Quick start links (last step) */}
        {currentStep === steps.length - 1 && (
          <div className="mt-6 pt-6 border-t border-gray-800 grid grid-cols-2 gap-3">
            <Link
              href="/companions/demo"
              onClick={handleClose}
              className="px-4 py-2 text-center border border-gray-700 hover:border-purple-500 rounded-lg text-sm font-medium transition-all"
            >
              Try Demo
            </Link>
            <Link
              href="/companions/create"
              onClick={handleClose}
              className="px-4 py-2 text-center bg-purple-500/20 border border-purple-500/50 hover:bg-purple-500/30 rounded-lg text-sm font-medium transition-all"
            >
              Create Companion
            </Link>
          </div>
        )}

        {/* Skip option */}
        <button
          onClick={handleClose}
          className="w-full mt-4 text-sm text-gray-500 hover:text-gray-400 transition"
        >
          Skip tutorial
        </button>
      </div>
    </div>
  )
}
