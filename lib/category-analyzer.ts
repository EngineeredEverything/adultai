type Category = {
  name: string
  keywords: string[]
}

export function analyzePromptForCategory(prompt: string, categories: Category[]): string | null {
  if (!prompt || prompt.trim() === '') return null

  const lowerPrompt = prompt.toLowerCase()

  const scores = categories.map(category => {
    let score = 0
    for (const keyword of category.keywords) {
      if (lowerPrompt.includes(keyword.toLowerCase())) {
        score += 1
        const regex = new RegExp(`\\b${keyword.toLowerCase()}\\b`, 'g')
        const exactMatches = (lowerPrompt.match(regex) || []).length
        score += exactMatches
      }
    }

    return {
      category: category.name,
      score
    }
  })

  scores.sort((a, b) => b.score - a.score)

  return scores.length > 0 && scores[0].score > 0 ? scores[0].category : categories[0].name
}
