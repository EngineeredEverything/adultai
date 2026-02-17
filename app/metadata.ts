import { Metadata } from "next";

export const RootLayoutMetadata: Metadata = {
    title: {
        template: "%s | AdultAI - AI Image Generation",
        default: "AdultAI - A Safer Way to Adult",
        absolute: "AdultAI - Create Unique AI-Generated Images",
    },
    description:
        "AdultAI is a powerful platform for creating customized AI-generated images. Utilize advanced models, adjustable parameters, and unique styles to bring your creative vision to life.",
    keywords: [
        // Base keywords
        "AI",
        "Image Generation",
        "Art",
        "AdultAI",
        "AI Art",
        "Digital Creation",

        // Specific features
        "custom AI images",
        "advanced image generation",
        "AI art platform",
        "AI creativity",
        "digital art creation",
        "personalized AI art",
        "model parameters",
        "creative AI platform",
        "image customization",
        "AI art styles",
    ],
    authors: [{ name: "Clay" }],
    creator: "Clay",
    publisher: "Clay",
    formatDetection: {
        email: false,
        address: false,
        telephone: false,
    },
    openGraph: {
        type: "website",
        siteName: "AdultAI",
        title: "AdultAI - Advanced AI Image Generation",
        description:
            "Create unique, customized AI-generated images with powerful controls and features",
        images: [
            {
                url: "/og-image.jpg", // Replace with your actual OG image path
                width: 1200,
                height: 630,
                alt: "AdultAI - AI Image Generation Platform",
            },
        ],
    },
    twitter: {
        card: "summary_large_image",
        title: "AdultAI - Create Unique AI-Generated Images",
        description:
            "Powerful AI image generation with customizable parameters and styles",
        images: ["/twitter-image.jpg"], // Replace with your actual Twitter image path
        creator: "@YourTwitterHandle", // Replace with actual handle if applicable
    },
    // viewport: "width=device-width, initial-scale=1",
    robots: {
        index: true,
        follow: true,
    },
    // themeColor: "#4F46E5", // Replace with your brand's primary color
    applicationName: "AdultAI",
    category: "technology",
    alternates: {
        canonical: "https://yourdomain.com", // Replace with your actual domain
    },
};
