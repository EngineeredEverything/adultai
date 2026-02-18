import { Metadata } from 'next';
import CompanionCustomizer from './CompanionCustomizer';

export const metadata: Metadata = {
  title: 'Customize Your AI Companion | AdultAI',
  description: 'Create your perfect AI companion with our advanced customization tool. Choose appearance, personality, and more.',
};

export default function CustomizePage({
  searchParams,
}: {
  searchParams: { based?: string };
}) {
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">
            Customize Your Companion
          </h1>
          <p className="text-gray-400 text-lg">
            Fine-tune every detail to create your perfect AI companion
          </p>
        </div>

        <CompanionCustomizer basedOnSlug={searchParams.based} />
      </div>
    </div>
  );
}
