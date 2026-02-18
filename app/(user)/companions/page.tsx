import { currentUser } from "@/utils/auth"
import { redirect } from "next/navigation"
import { getCharacters } from "@/actions/characters/create"
import Link from "next/link"

export default async function CompanionsPage() {
  const user = await currentUser()
  if (!user) redirect("/auth/login?callbackUrl=/companions")

  const result = await getCharacters()
  const characters = "characters" in result ? result.characters : []

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Your Companions
            </h1>
            <p className="text-gray-400 mt-1">Create and chat with AI companions</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Link
              href="/companions/showcase"
              className="px-4 py-2 border border-gray-700 hover:border-purple-500 rounded-xl font-medium transition-all duration-200 text-sm"
            >
              Browse Showcase
            </Link>
            <Link
              href="/companions/create"
              className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-6 py-3 rounded-xl font-medium transition-all duration-200 flex items-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              New Companion
            </Link>
          </div>
        </div>

        {/* Characters Grid */}
        {characters.length === 0 ? (
          <div className="text-center py-12">
            <div className="max-w-2xl mx-auto">
              <div className="text-6xl mb-4">💫</div>
              <h2 className="text-2xl font-semibold mb-2">No companions yet</h2>
              <p className="text-gray-400 mb-8">Create your first AI companion or explore our showcase for inspiration</p>
              <div className="flex gap-4 justify-center flex-wrap">
                <Link
                  href="/companions/showcase"
                  className="inline-flex items-center gap-2 border border-purple-500 hover:bg-purple-500/10 px-6 py-3 rounded-xl font-medium transition-all duration-200"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  Explore Showcase
                </Link>
                <Link
                  href="/companions/create"
                  className="inline-flex items-center gap-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-4 rounded-xl font-medium text-lg transition-all duration-200"
                >
                  Create Your First Companion
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {characters.map((char) => (
              <Link
                key={char.id}
                href={`/companions/${char.id}/chat`}
                className="group bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-purple-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-purple-500/10"
              >
                {/* Portrait */}
                <div className="aspect-[3/4] bg-gray-800 relative overflow-hidden">
                  {char.portraitUrl ? (
                    <img
                      src={char.portraitUrl}
                      alt={char.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <div className="text-6xl mb-2">
                          {char.appearance === "anime" ? "🎨" : char.appearance === "artistic" ? "🖼️" : "📷"}
                        </div>
                        <p className="text-gray-500 text-sm">No portrait yet</p>
                      </div>
                    </div>
                  )}
                  {/* Personality badge */}
                  <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm px-3 py-1 rounded-full text-xs capitalize">
                    {char.personality}
                  </div>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="text-lg font-semibold">{char.name}</h3>
                  <p className="text-gray-400 text-sm mt-1 line-clamp-2">
                    {char.description || `A ${char.personality} ${char.appearance} companion`}
                  </p>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                    <span>{char._count.messages} messages</span>
                    <span>
                      {new Date(char.updatedAt).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
