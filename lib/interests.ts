/** Interest options for content personalization */
export const INTEREST_OPTIONS = [
  { id: "women",     label: "Women",    emoji: "👩", keywords: ["women", "female", "girl", "babe", "milf", "woman"] },
  { id: "men",       label: "Men",      emoji: "👨", keywords: ["men", "male", "guy", "man", "hunk"] },
  { id: "couples",   label: "Couples",  emoji: "💑", keywords: ["couple", "couples", "threesome", "group"] },
  { id: "fantasy",   label: "Fantasy",  emoji: "🔮", keywords: ["fantasy", "magical", "elf", "demon", "supernatural", "mythical"] },
  { id: "anime",     label: "Anime",    emoji: "🎌", keywords: ["anime", "hentai", "illustrated", "manga", "cartoon"] },
  { id: "realistic", label: "Realistic",emoji: "📷", keywords: ["realistic", "photorealistic", "real"] },
  { id: "outdoor",   label: "Outdoor",  emoji: "🌿", keywords: ["outdoor", "nature", "beach", "pool", "public"] },
  { id: "lingerie",  label: "Lingerie", emoji: "👙", keywords: ["lingerie", "underwear", "stockings", "bra"] },
  { id: "bdsm",      label: "BDSM",     emoji: "⛓️", keywords: ["bdsm", "bondage", "dominant", "submissive", "fetish"] },
  { id: "petite",    label: "Petite",   emoji: "✨", keywords: ["petite", "slim", "skinny", "small"] },
  { id: "curvy",     label: "Curvy",    emoji: "🌸", keywords: ["curvy", "plus", "thick", "bbw", "busty"] },
  { id: "mature",    label: "Mature",   emoji: "🥂", keywords: ["mature", "milf", "cougar", "older"] },
] as const

export type InterestId = typeof INTEREST_OPTIONS[number]["id"]

/** Get all keywords for a set of interest IDs */
export function getKeywordsForInterests(interestIds: string[]): string[] {
  if (!interestIds.length) return []
  return INTEREST_OPTIONS
    .filter(opt => interestIds.includes(opt.id))
    .flatMap(opt => [...opt.keywords])
}
