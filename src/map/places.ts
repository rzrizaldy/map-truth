// The demo's whole claim is that the image is grounded in a real place. If the
// prompt names a place, the map has to be able to go there — otherwise "Jakarta
// map overlay" happily renders New York and nothing is grounded to the ask.

// Common shorthands people actually type. Nominatim resolves most full names on
// its own; these are the ones it would miss or resolve somewhere unhelpful.
const ALIASES: Record<string, string> = {
  nyc: 'New York City',
  nj: 'New Jersey',
  ny: 'New York',
  la: 'Los Angeles',
  sf: 'San Francisco',
  dc: 'Washington, D.C.',
  uk: 'United Kingdom',
  usa: 'United States',
  us: 'United States',
  uae: 'United Arab Emirates',
  jkt: 'Jakarta',
  sg: 'Singapore',
  kl: 'Kuala Lumpur',
  hk: 'Hong Kong',
  bcn: 'Barcelona',
  cdmx: 'Mexico City',
}

// Words that get capitalised in art briefs but are never places.
const STOPWORDS = new Set([
  'a', 'an', 'the', 'map', 'maps', 'overlay', 'poster', 'print', 'city', 'region', 'area',
  'based', 'on', 'vibes', 'vibe', 'with', 'and', 'or', 'of', 'in', 'at', 'for', 'from', 'to',
  'hypothetical', 'imaginary', 'fictional', 'style', 'styled', 'editorial', 'bold', 'minimal',
  'create', 'make', 'draw', 'generate', 'render', 'show', 'i', 'want', 'please', 'like',
  'black', 'white', 'cream', 'red', 'blue', 'green', 'yellow', 'orange', 'purple', 'grey', 'gray',
  'gpt', 'image', 'ai', 'if', 'it', 'had', 'has', 'lived', 'here', 'were', 'was', 'be',
])

export type PlaceMention = { text: string; query: string }

const titleCased = (word: string) => /^[A-Z][a-z'’-]+$/.test(word)
const acronym = (word: string) => /^[A-Z]{2,5}$/.test(word)

/**
 * Pull candidate place mentions out of free-form prompt text.
 *
 * Deliberately a heuristic and not an LLM call: it runs on every keystroke, must
 * be deterministic so the user can predict the chips, and a wrong guess costs
 * nothing because the user still has to click one.
 */
export const extractPlaceMentions = (prompt: string, limit = 4): PlaceMention[] => {
  const cleaned = prompt.replace(/[^\p{L}\p{N}\s,.'’-]/gu, ' ')
  const words = cleaned.split(/\s+/).filter(Boolean)
  const found: PlaceMention[] = []
  const seen = new Set<string>()

  const push = (text: string, query: string) => {
    const key = query.toLowerCase()
    if (seen.has(key) || found.length >= limit) return
    seen.add(key)
    found.push({ text, query })
  }

  for (let index = 0; index < words.length; index += 1) {
    const bare = words[index].replace(/[.,]+$/, '')
    if (!bare) continue
    const lower = bare.toLowerCase()

    if (ALIASES[lower] && (acronym(bare) || titleCased(bare))) {
      push(bare, ALIASES[lower])
      continue
    }
    if (STOPWORDS.has(lower)) continue

    if (titleCased(bare)) {
      // Greedily absorb following capitalised words: "New York City", "Kuala Lumpur".
      const parts = [bare]
      let ahead = index + 1
      while (ahead < words.length && parts.length < 4) {
        const next = words[ahead].replace(/[.,]+$/, '')
        if (!titleCased(next) || STOPWORDS.has(next.toLowerCase())) break
        parts.push(next)
        ahead += 1
      }
      index = ahead - 1
      const phrase = parts.join(' ')
      push(phrase, phrase)
      continue
    }
    if (acronym(bare) && !STOPWORDS.has(lower)) push(bare, bare)
  }

  return found
}

/** True when the locked place plainly does not match any place the prompt names. */
export const promptMatchesPlace = (mentions: PlaceMention[], placeLabel?: string) => {
  if (!mentions.length || !placeLabel) return true
  const haystack = placeLabel.toLowerCase()
  return mentions.some(({ text, query }) =>
    haystack.includes(text.toLowerCase()) || haystack.includes(query.toLowerCase()))
}
