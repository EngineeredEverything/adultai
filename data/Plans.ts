export const plans = [
  {
    id: "free",
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    description: "Basic access to AI image generation",
    features: ["200 TEMPT per month", "Basic image resolution", "Standard response time",],
    limitations: ["No negative prompts", "No style customization", "Limited to 2 image per generation"],
    nuts: 200,
    imagesPerDay: 20,
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
    description: "Enhanced image generation capabilities",
    features: [
      "500 TEMPT per month",
      "HD image resolution",
      "Faster response time",
      "Basic negative prompts",
      "Up to 4 images per generation",
      "public sharing"
    ],
    limitations: ["Limited style customization", "No advanced settings"],
    nuts: 500,
    imagesPerDay: 50,
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
    description: "Professional image generation suite",
    features: [
      "1,500 TEMPT per month",
      "4K image resolution",
      "Priority response time",
      "Advanced negative prompts",
      "Full style customization",
      "Advanced generation settings",
      "Up to 4 images per generation",
      "Custom models and LoRA",
      "public sharing"
    ],
    limitations: [],
    nuts: 1500,
    imagesPerDay: 100,
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
    description: "Unlimited creative potential",
    features: [
      "Unlimited TEMPT",
      "8K image resolution",
      "Instant response time",
      "Advanced negative prompts",
      "Full style customization",
      "All advanced settings",
      "Up to 10 images per generation",
      "Priority support",
      "Early access to new features",
      "public sharing"
    ],
    limitations: [],
    nuts: Number.POSITIVE_INFINITY,
    imagesPerDay: Number.POSITIVE_INFINITY,
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
