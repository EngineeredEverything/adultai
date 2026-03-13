export const dynamic = "force-dynamic";
import { Metadata } from 'next';
import { db as prisma } from '@/lib/db';
import Link from 'next/link';
import { Star } from 'lucide-react';

export const revalidate = 60;

export const metadata: Metadata = {
  title: 'AI Companion Showcase | AdultAI',
  description: 'Explore our diverse collection of AI companions. From angels to demons, catgirls to vampires - find your perfect digital companion.',
};

export default async function ShowcasePage() {
  const companions = await prisma.companion.findMany({
    where: { featured: true },
    orderBy: [
      { pinned: 'desc' },
      { createdAt: 'desc' },
    ],
  });

  // Spotlight: Sofanda Cox + Mike Hawk always first
  const SPOTLIGHT_SLUGS = ['sofonda-cox', 'kai-surfer-adventurer'];
  const spotlightCompanions = SPOTLIGHT_SLUGS
    .map(slug => companions.find((c: any) => c.slug === slug))
    .filter(Boolean);
  const pinnedCompanions = companions.filter((c: any) => c.pinned && !SPOTLIGHT_SLUGS.includes(c.slug));
  const fantasyCompanions = companions.filter((c: any) => !c.pinned && c.category === 'fantasy');
  const realisticCompanions = companions.filter((c: any) => !c.pinned && c.category === 'realistic');

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-12">
        <h1 className="text-5xl font-bold mb-4">Companion Showcase</h1>
        <p className="text-xl text-gray-400 mb-8">
          Explore our collection of pre-designed AI companions, or create your own
        </p>
        <Link
          href="/companions/customize"
          className="inline-block bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-bold px-8 py-4 rounded-lg text-lg"
        >
          ✨ Create Custom Companion
        </Link>
      </div>

      {/* ⭐ Spotlight companions — Sofanda Cox & Mike Hawk */}
      {spotlightCompanions.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            <h2 className="text-3xl font-bold">Spotlight</h2>
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {spotlightCompanions.map((companion: any) => (
              <CompanionCard key={companion.id} companion={companion} featured />
            ))}
          </div>
        </section>
      )}

      {/* ⭐ Other pinned companions */}
      {pinnedCompanions.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center gap-3 mb-6">
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
            <h2 className="text-3xl font-bold">Featured Companions</h2>
            <Star className="w-6 h-6 text-yellow-400 fill-yellow-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {pinnedCompanions.map((companion: any) => (
              <CompanionCard key={companion.id} companion={companion} featured />
            ))}
          </div>
        </section>
      )}

      {/* Fantasy Companions */}
      {fantasyCompanions.length > 0 && (
        <section className="mb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">Fantasy Companions</h2>
            <span className="text-gray-400">{fantasyCompanions.length} available</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {fantasyCompanions.map((companion: any) => (
              <CompanionCard key={companion.id} companion={companion} />
            ))}
          </div>
        </section>
      )}

      {/* Realistic Companions */}
      {realisticCompanions.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-3xl font-bold">Realistic Companions</h2>
            <span className="text-gray-400">{realisticCompanions.length} available</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {realisticCompanions.map((companion: any) => (
              <CompanionCard key={companion.id} companion={companion} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function CompanionCard({ companion, featured = false }: { companion: any; featured?: boolean }) {
  return (
    <div className={`rounded-lg overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300 relative
      ${featured ? 'bg-gray-800 ring-2 ring-yellow-400/60' : 'bg-gray-800'}`}>
      {featured && (
        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-yellow-400 text-black text-xs font-bold px-2 py-1 rounded-full shadow-lg">
          <Star className="w-3 h-3 fill-black" />
          Featured
        </div>
      )}

      <Link href={`/companions/demo?character=${companion.slug}`} className="block relative aspect-[2/3] group cursor-pointer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={companion.imageUrl?.includes('b-cdn.net')
            ? `${companion.imageUrl.split('?')[0]}?width=400&format=webp&quality=85`
            : companion.imageUrl}
          alt={companion.name}
          className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300 flex items-center justify-center">
          <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-purple-600/90 backdrop-blur-sm text-white text-sm font-semibold px-4 py-2 rounded-full">
            ▶ Try Demo
          </span>
        </div>
        <div className={`absolute top-2 right-2 ${featured ? 'top-2' : ''}`}>
          <span className="bg-purple-600/90 px-3 py-1 rounded-full text-xs font-semibold">
            {companion.archetype}
          </span>
        </div>
      </Link>

      <div className="p-4">
        <h3 className="text-xl font-bold mb-1">{companion.name}</h3>
        <p className="text-purple-400 text-sm mb-2">{companion.personality}</p>
        <p className="text-gray-300 text-xs mb-4 line-clamp-2">
          {companion.description}
        </p>

        {companion.traits && companion.traits.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {companion.traits.slice(0, 3).map((trait: string) => (
              <span key={trait} className="bg-purple-600/20 text-purple-300 px-2 py-1 rounded text-xs">
                {trait}
              </span>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-2">
          <Link
            href={`/companions/demo?character=${companion.slug}`}
            className="bg-blue-600 hover:bg-blue-700 text-white text-center font-semibold px-4 py-2 rounded text-sm"
          >
            Try Demo
          </Link>
          <Link
            href={`/companions/customize?based=${companion.slug}`}
            className="bg-purple-600 hover:bg-purple-700 text-white text-center font-semibold px-4 py-2 rounded text-sm"
          >
            Customize
          </Link>
        </div>
      </div>
    </div>
  );
}
