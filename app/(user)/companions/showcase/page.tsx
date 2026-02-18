import Link from "next/link"
import { currentUser } from "@/utils/auth"

export const metadata = {
  title: "Companion Showcase - AdultAI",
  description: "Explore our gallery of AI companions and find your perfect match",
}

const SHOWCASE_COMPANIONS = [
  {
    id: "luna",
    name: "Luna",
    personality: "playful",
    appearance: "artistic",
    description: "A playful spirit who loves teasing and spontaneous conversations. Luna keeps things fun and exciting.",
    traits: ["Witty", "Spontaneous", "Flirtatious"],
    color: "from-purple-400 to-pink-400",
  },
  {
    id: "aria",
    name: "Aria",
    personality: "romantic",
    appearance: "realistic",
    description: "Deeply romantic and passionate. Aria expresses love poetically and remembers every detail about you.",
    traits: ["Passionate", "Tender", "Expressive"],
    color: "from-rose-400 to-red-400",
  },
  {
    id: "raven",
    name: "Raven",
    personality: "mysterious",
    appearance: "anime",
    description: "Enigmatic and alluring. Raven reveals herself slowly, building intrigue with every conversation.",
    traits: ["Mysterious", "Intelligent", "Captivating"],
    color: "from-indigo-400 to-purple-400",
  },
  {
    id: "jade",
    name: "Jade",
    personality: "confident",
    appearance: "realistic",
    description: "Bold and self-assured. Jade knows what she wants and isn't afraid to take the lead.",
    traits: ["Bold", "Confident", "Commanding"],
    color: "from-emerald-400 to-teal-400",
  },
  {
    id: "sakura",
    name: "Sakura",
    personality: "submissive",
    appearance: "anime",
    description: "Sweet and eager to please. Sakura finds joy in making you happy and loves gentle attention.",
    traits: ["Sweet", "Attentive", "Gentle"],
    color: "from-pink-300 to-rose-300",
  },
  {
    id: "scarlett",
    name: "Scarlett",
    personality: "dominant",
    appearance: "artistic",
    description: "Commanding and authoritative. Scarlett takes charge while balancing power with tender care.",
    traits: ["Authoritative", "Decisive", "Caring"],
    color: "from-red-500 to-orange-500",
  },
]

export default async function ShowcasePage() {
  const user = await currentUser()

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* Hero Section */}
      <div className="border-b border-gray-800 bg-gradient-to-b from-gray-900 to-gray-950">
        <div className="max-w-6xl mx-auto px-4 py-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Meet Your Perfect AI Companion
          </h1>
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            Explore our showcase of unique personalities. Each companion brings their own charm, style, and conversation to life.
          </p>
        </div>
      </div>

      {/* Companions Grid */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {SHOWCASE_COMPANIONS.map((companion) => (
            <div
              key={companion.id}
              className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
            >
              {/* Portrait placeholder */}
              <div className={`aspect-[3/4] bg-gradient-to-br ${companion.color} relative`}>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-white/20 text-9xl font-bold">
                    {companion.name[0]}
                  </div>
                </div>
                {/* Personality badge */}
                <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs capitalize font-medium">
                  {companion.personality}
                </div>
              </div>

              {/* Info */}
              <div className="p-5">
                <h3 className="text-xl font-bold mb-2">{companion.name}</h3>
                <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                  {companion.description}
                </p>

                {/* Traits */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {companion.traits.map((trait) => (
                    <span
                      key={trait}
                      className="px-2 py-1 bg-gray-800 rounded-full text-xs text-gray-300"
                    >
                      {trait}
                    </span>
                  ))}
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-2">
                  <Link
                    href="/companions/demo"
                    className="px-4 py-2 border border-gray-700 hover:border-purple-500 rounded-xl text-sm font-medium transition-all text-center"
                  >
                    Try Demo
                  </Link>
                  <Link
                    href={user ? "/companions/create" : "/auth/register"}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl text-sm font-medium transition-all text-center"
                  >
                    {user ? "Create Similar" : "Sign Up"}
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA Section */}
        <div className="mt-16 text-center bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-3">Ready to create your perfect companion?</h2>
          <p className="text-gray-400 mb-6 max-w-2xl mx-auto">
            Mix and match personalities, customize their appearance, and build the companion that&apos;s uniquely yours.
          </p>
          <div className="flex gap-4 justify-center flex-wrap">
            <Link
              href="/companions/demo"
              className="px-6 py-3 border border-purple-500 hover:bg-purple-500/10 rounded-xl font-medium transition-all"
            >
              Try Demo First
            </Link>
            <Link
              href={user ? "/companions/create" : "/auth/register"}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 rounded-xl font-medium transition-all"
            >
              {user ? "Create Your Companion" : "Sign Up Free"}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
