'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

interface Characteristics {
  hairColor: string;
  hairStyle: string;
  eyeColor: string;
  skinTone: string;
  bodyType: string;
  ethnicity: string;
  style: string;
}

interface Companion {
  name: string;
  slug: string;
  imageUrl: string;
  personality: string;
  traits: string[];
  description: string;
  characteristics: Characteristics;
}

const hairColorOptions = [
  'blonde', 'brunette', 'black', 'red', 'strawberry-blonde', 
  'platinum-blonde', 'icy-blonde', 'brown-highlights', 
  'black-purple', 'pink', 'silver-gray'
];

const hairStyleOptions = [
  'long-wavy', 'long-straight', 'long-flowing', 'medium-wavy', 
  'medium-natural', 'short-curly', 'short-pixie', 'short-spiky',
  'curly-afro', 'elegant-updo', 'sleek-straight'
];

const eyeColorOptions = [
  'blue', 'brown', 'green', 'hazel', 'gray', 'dark-brown',
  'bright-blue', 'ice-blue', 'blue-green', 'amber', 'violet'
];

const skinToneOptions = [
  'pale', 'fair', 'fair-freckles', 'medium', 'tan', 'olive',
  'caramel', 'bronze', 'dark', 'porcelain', 'light-brown'
];

const bodyTypeOptions = [
  'petite', 'slim', 'athletic', 'fit', 'average', 'curvy',
  'voluptuous', 'hourglass', 'muscular', 'tall-slim', 'lean'
];

const ethnicityOptions = [
  'caucasian', 'african', 'asian', 'latina', 'middle-eastern',
  'indian', 'scandinavian', 'mixed-race'
];

const styleOptions = [
  'casual', 'elegant', 'sophisticated', 'sporty', 'athletic',
  'business', 'goth', 'punk', 'bohemian', 'minimalist',
  'traditional', 'exotic', 'vibrant', 'luxurious'
];

const personalityOptions = [
  'Playful & Fun', 'Confident & Bold', 'Sweet & Caring',
  'Mysterious & Enigmatic', 'Passionate & Intense',
  'Intelligent & Sophisticated', 'Free-Spirited & Adventurous',
  'Dominant & Commanding', 'Gentle & Nurturing',
  'Rebellious & Edgy', 'Romantic & Sensual', 'Ambitious & Driven'
];

export default function CompanionCustomizer({ basedOnSlug }: { basedOnSlug?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [customization, setCustomization] = useState<Characteristics>({
    hairColor: 'blonde',
    hairStyle: 'long-wavy',
    eyeColor: 'blue',
    skinTone: 'fair',
    bodyType: 'athletic',
    ethnicity: 'caucasian',
    style: 'casual'
  });

  const [name, setName] = useState('');
  const [personality, setPersonality] = useState('Playful & Fun');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (basedOnSlug) {
      loadBaseCompanion(basedOnSlug);
    }
  }, [basedOnSlug]);

  async function loadBaseCompanion(slug: string) {
    try {
      setLoading(true);
      const res = await fetch(`/api/companions/${slug}`);
      if (res.ok) {
        const companion: Companion = await res.json();
        setCustomization(companion.characteristics);
        setName(companion.name);
        setPersonality(companion.personality);
        setDescription(companion.description);
        setPreviewUrl(companion.imageUrl);
      }
    } catch (error) {
      console.error('Failed to load base companion:', error);
    } finally {
      setLoading(false);
    }
  }

  function updateCharacteristic(key: keyof Characteristics, value: string) {
    setCustomization(prev => ({ ...prev, [key]: value }));
  }

  async function generatePreview() {
    setGenerating(true);
    try {
      // Build prompt from customization
      const prompt = buildPromptFromCustomization();
      
      const res = await fetch('/api/generate-companion-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, characteristics: customization })
      });

      if (res.ok) {
        const data = await res.json();
        setPreviewUrl(data.imageUrl);
      }
    } catch (error) {
      console.error('Failed to generate preview:', error);
    } finally {
      setGenerating(false);
    }
  }

  function buildPromptFromCustomization(): string {
    const parts = [];
    
    // Body type and ethnicity
    parts.push(`beautiful ${customization.ethnicity} woman`);
    parts.push(`${customization.bodyType} body`);
    
    // Hair
    parts.push(`${customization.hairStyle} ${customization.hairColor} hair`);
    
    // Eyes
    parts.push(`${customization.eyeColor} eyes`);
    
    // Skin
    parts.push(`${customization.skinTone} skin`);
    
    // Style
    parts.push(`${customization.style} outfit`);
    
    // Quality
    parts.push('photorealistic, detailed face, 8k');
    
    return parts.join(', ');
  }

  async function createCompanion() {
    if (!name.trim()) {
      alert('Please enter a name for your companion');
      return;
    }

    try {
      setLoading(true);
      
      const res = await fetch('/api/companions/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          personality,
          description,
          characteristics: customization,
          imageUrl: previewUrl
        })
      });

      if (res.ok) {
        const data = await res.json();
        router.push(`/companions/chat/${data.companionId}`);
      }
    } catch (error) {
      console.error('Failed to create companion:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Customization Panel */}
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Basic Info</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
                placeholder="Enter companion name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Personality</label>
              <select
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
              >
                {personalityOptions.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2 h-24"
                placeholder="Describe your companion's personality and traits..."
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Appearance</h2>
          
          <div className="space-y-4">
            {/* Hair Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Hair Color</label>
              <select
                value={customization.hairColor}
                onChange={(e) => updateCharacteristic('hairColor', e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
              >
                {hairColorOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Hair Style */}
            <div>
              <label className="block text-sm font-medium mb-2">Hair Style</label>
              <select
                value={customization.hairStyle}
                onChange={(e) => updateCharacteristic('hairStyle', e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
              >
                {hairStyleOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Eye Color */}
            <div>
              <label className="block text-sm font-medium mb-2">Eye Color</label>
              <select
                value={customization.eyeColor}
                onChange={(e) => updateCharacteristic('eyeColor', e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
              >
                {eyeColorOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Skin Tone */}
            <div>
              <label className="block text-sm font-medium mb-2">Skin Tone</label>
              <select
                value={customization.skinTone}
                onChange={(e) => updateCharacteristic('skinTone', e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
              >
                {skinToneOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Body Type */}
            <div>
              <label className="block text-sm font-medium mb-2">Body Type</label>
              <select
                value={customization.bodyType}
                onChange={(e) => updateCharacteristic('bodyType', e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
              >
                {bodyTypeOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Ethnicity */}
            <div>
              <label className="block text-sm font-medium mb-2">Ethnicity</label>
              <select
                value={customization.ethnicity}
                onChange={(e) => updateCharacteristic('ethnicity', e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
              >
                {ethnicityOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            {/* Style */}
            <div>
              <label className="block text-sm font-medium mb-2">Style</label>
              <select
                value={customization.style}
                onChange={(e) => updateCharacteristic('style', e.target.value)}
                className="w-full bg-gray-700 rounded px-4 py-2"
              >
                {styleOptions.map(option => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={generatePreview}
            disabled={generating}
            className="w-full mt-6 bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            {generating ? 'Generating Preview...' : '🎨 Generate Preview'}
          </button>
        </div>
      </div>

      {/* Preview Panel */}
      <div className="space-y-6">
        <div className="bg-gray-800 rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">Preview</h2>
          
          {previewUrl ? (
            <div className="relative aspect-[2/3] rounded-lg overflow-hidden mb-4">
              <Image
                src={previewUrl}
                alt="Companion preview"
                fill
                className="object-cover"
              />
            </div>
          ) : (
            <div className="aspect-[2/3] bg-gray-700 rounded-lg flex items-center justify-center mb-4">
              <p className="text-gray-400">Generate a preview to see your companion</p>
            </div>
          )}

          {name && (
            <div className="mb-4">
              <h3 className="text-2xl font-bold">{name}</h3>
              <p className="text-purple-400">{personality}</p>
              {description && (
                <p className="text-gray-300 text-sm mt-2">{description}</p>
              )}
            </div>
          )}

          <div className="bg-gray-700 rounded-lg p-4 mb-4">
            <h4 className="font-semibold mb-2">Characteristics</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-gray-400">Hair:</span>{' '}
                <span className="text-white">{customization.hairStyle} {customization.hairColor}</span>
              </div>
              <div>
                <span className="text-gray-400">Eyes:</span>{' '}
                <span className="text-white">{customization.eyeColor}</span>
              </div>
              <div>
                <span className="text-gray-400">Skin:</span>{' '}
                <span className="text-white">{customization.skinTone}</span>
              </div>
              <div>
                <span className="text-gray-400">Body:</span>{' '}
                <span className="text-white">{customization.bodyType}</span>
              </div>
              <div>
                <span className="text-gray-400">Ethnicity:</span>{' '}
                <span className="text-white">{customization.ethnicity}</span>
              </div>
              <div>
                <span className="text-gray-400">Style:</span>{' '}
                <span className="text-white">{customization.style}</span>
              </div>
            </div>
          </div>

          <button
            onClick={createCompanion}
            disabled={loading || !previewUrl || !name}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg disabled:opacity-50"
          >
            {loading ? 'Creating...' : '✨ Create Companion'}
          </button>
        </div>

        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
          <h3 className="font-semibold mb-2">💡 Tips</h3>
          <ul className="text-sm text-gray-300 space-y-1">
            <li>• Mix and match characteristics to create unique looks</li>
            <li>• Generate preview to see your changes instantly</li>
            <li>• Each generation uses credits from your account</li>
            <li>• Save your favorite combinations for later</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
