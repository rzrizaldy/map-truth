// The level-3 poster used to carry a fixed slogan, which made every result look
// like the same template. Its heading now comes from what the user actually asked for.

const NOISE = /\b(create|make|draw|generate|render|show|please|a|an|the|in|with|of|based on|style|styled)\b/gi

export const posterTitleFromPrompt = (prompt: string, fallback = 'Your map') => {
  const firstClause = prompt.split(/[.\n]|,(?=\s)/)[0] ?? ''
  const cleaned = firstClause
    .replace(NOISE, ' ')
    .replace(/[^\p{L}\p{N}\s'’+-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  if (!cleaned) return fallback
  const words = cleaned.split(' ')
  const title = words.slice(0, 6).join(' ').replace(/[\s'’+-]+$/u, '')
  if (!title) return fallback
  return title.length > 46 ? `${title.slice(0, 45).trimEnd()}…` : title
}
