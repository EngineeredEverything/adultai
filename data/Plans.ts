export const plans = [
  {
    id: "free",
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    description: "Try AI image generation — no credit card required",
    features: [
      "200 TEMPT per month",
      "Up to 2 images per generation",
      "512×512 resolution",
      "Standard queue",
    ],
    limitations: ["No negative prompts", "No style customization", "512×512 max resolution"],
    nuts: 200,
    imagesPerDay: -1,
    imagesPerGeneration: 2,
    popular: false,
    buttonText: "Current Plan",
    buttonVariant: "outline" as const,
    disabled: true,
  },
  {
    id: "basic",
    name: "Basic",
    price: { monthly: 9.99, yearly: 99.99 },
    description: "More TEMPT, higher resolution, faster queue",
    features: [
      "500 TEMPT per month",
      "Up to 4 images per generation",
      "1024×1024 resolution",
      "Faster response time",
      "Negative prompts",
      "Public sharing",
    ],
    limitations: ["No advanced settings", "No custom models"],
    nuts: 500,
    imagesPerDay: -1,
    imagesPerGeneration: 4,
    popular: false,
    buttonText: "Subscribe",
    buttonVariant: "outline" as const,
    disabled: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: { monthly: 19.99, yearly: 199.99 },
    description: "Full creative control with premium quality",
    features: [
      "1,500 TEMPT per month",
      "Up to 4 images per generation",
      "2048×2048 resolution (4K)",
      "Priority queue",
      "Advanced negative prompts",
      "Full style customization",
      "Advanced generation settings",
      "Custom models and LoRA",
      "Public sharing",
    ],
    limitations: [],
    nuts: 1500,
    imagesPerDay: -1,
    imagesPerGeneration: 4,
    popular: true,
    buttonText: "Subscribe",
    buttonVariant: "default" as const,
    disabled: false,
  },
  {
    id: "unlimited",
    name: "Unlimited",
    price: { monthly: 39.99, yearly: 399.99 },
    description: "Maximum output for power users",
    features: [
      "5,000 TEMPT per month",
      "Up to 10 images per generation",
      "4096×4096 resolution (8K)",
      "Instant queue",
      "Advanced negative prompts",
      "Full style customization",
      "All advanced settings",
      "Custom models and LoRA",
      "Priority support",
      "Early access to new features",
      "Public sharing",
    ],
    limitations: [],
    nuts: 5000,
    imagesPerDay: -1,
    imagesPerGeneration: 10,
    popular: false,
    buttonText: "Subscribe",
    buttonVariant: "outline" as const,
    disabled: false,
  },
]

// Helper function to check if it's a new month
export const isNewMonth = (lastResetDate: Date): boolean => {
  const now = new Date()
  const lastReset = new Date(lastResetDate)
  return now.getMonth() !== lastReset.getMonth() || now.getFullYear() !== lastReset.getFullYear()
}

// Helper function to check if it's a new day
export const isNewDay = (lastDate: Date): boolean => {
  const now = new Date()
  const last = new Date(lastDate)
  return now.toDateString() !== last.toDateString()
}
