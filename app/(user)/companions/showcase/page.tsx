import { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import Image from 'next/image';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI Companion Showcase | AdultAI',
  description: 'Explore our diverse collection of AI companions. From angels to demons, catgirls to vampires - find your perfect digital companion.',
};

export default async function ShowcasePage() {
  const companions = await prisma.companion.findMany({
    where: { featured: true },
    orderBy: { createdAt: 'desc' }
  });

  const fantasyCompanions = companions.filter(c => c.category === 'fantasy');
  const realisticCompanions = companions.filter(c => c.category === 'realistic');

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

      {/* Fantasy Companions */}
      <section className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Fantasy Companions</h2>
          <span className="text-gray-400">{fantasyCompanions.length} available</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {fantasyCompanions.map((companion) => (
            <CompanionCard key={companion.id} companion={companion} />
          ))}
        </div>
      </section>

      {/* Realistic Companions */}
      <section>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-3xl font-bold">Realistic Companions</h2>
          <span className="text-gray-400">{realisticCompanions.length} available</span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {realisticCompanions.map((companion) => (
            <CompanionCard key={companion.id} companion={companion} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CompanionCard({ companion }: { companion: any }) {
  return (
    <div className="bg-gray-800 rounded-lg overflow-hidden hover:shadow-2xl hover:scale-105 transition-all duration-300">
      <div className="relative aspect-[2/3]">
        <Image
          src={companion.imageUrl}
          alt={companion.name}
          fill
          className="object-cover"
        />
        <div className="absolute top-2 right-2">
          <span className="bg-purple-600/90 px-3 py-1 rounded-full text-xs font-semibold">
            {companion.archetype}
          </span>
        </div>
      </div>
      
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
