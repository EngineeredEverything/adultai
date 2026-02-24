/**
 * Tokenizes prompts into meaningful fragments for analysis.
 * Extracts single words, 2-grams, and 3-grams.
 * Filters out common stop words and very short tokens.
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
  "being", "have", "has", "had", "do", "does", "did", "will", "would",
  "could", "should", "may", "might", "shall", "can", "need", "must",
  "it", "its", "this", "that", "these", "those", "i", "me", "my",
  "we", "our", "you", "your", "he", "she", "they", "them", "their",
  "what", "which", "who", "whom", "how", "when", "where", "why",
  "not", "no", "nor", "so", "if", "then", "than", "too", "very",
  "just", "about", "above", "after", "again", "all", "also", "am",
  "any", "as", "because", "before", "between", "both", "each",
  "few", "here", "there", "some", "such", "only", "own", "same",
  "up", "down", "out", "off", "over", "under", "more", "most",
  "other", "into", "through", "during", "while", "once",
])

// Prompt-specific terms that are meaningful even as single words
const MEANINGFUL_SHORT_WORDS = new Set([
  "4k", "8k", "hd", "hdr", "raw", "uhd", "cgi", "3d", "2d",
])

/**
 * Clean and normalize a prompt string
 */
function cleanPrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[()[\]{}]/g, " ") // remove brackets
    .replace(/[,;:!?'"]/g, " ") // remove punctuation (keep hyphens for compound words)
    .replace(/\s+/g, " ")       // collapse whitespace
    .trim()
}

/**
 * Extract meaningful single-word tokens
 */
function extractWords(cleaned: string): string[] {
  return cleaned
    .split(" ")
    .filter(w => w.length >= 3 || MEANINGFUL_SHORT_WORDS.has(w))
    .filter(w => !STOP_WORDS.has(w))
    .filter(w => !/^\d+$/.test(w)) // skip pure numbers (unless part of compound)
}

/**
 * Extract n-grams from a list of words
 */
function extractNgrams(words: string[], n: number): string[] {
  const ngrams: string[] = []
  for (let i = 0; i <= words.length - n; i++) {
    ngrams.push(words.slice(i, i + n).join(" "))
  }
  return ngrams
}

export interface TokenizedPrompt {
  words: string[]
  bigrams: string[]
  trigrams: string[]
  allFragments: string[]
}

/**
 * Tokenize a prompt into words, bigrams, and trigrams.
 * Returns deduplicated fragments.
 */
export function tokenizePrompt(prompt: string): TokenizedPrompt {
  const cleaned = cleanPrompt(prompt)
  const words = extractWords(cleaned)
  const bigrams = extractNgrams(words, 2)
  const trigrams = extractNgrams(words, 3)

  const allFragments = [...new Set([...words, ...bigrams, ...trigrams])]

  return { words, bigrams, trigrams, allFragments }
}

/**
 * Extract only the most significant fragments (for prompt enhancement).
 * Focuses on descriptive terms: lighting, style, quality, composition, etc.
 */
export function extractDescriptiveFragments(prompt: string): string[] {
  const { words, bigrams } = tokenizePrompt(prompt)
  // For enhancement purposes, bigrams are most useful (e.g., "soft lighting", "cinematic shot")
  return [...new Set([...bigrams, ...words])]
}
