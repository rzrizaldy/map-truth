import { geocodePlace } from './geocode'
import { extractPlaceMentions } from './places'
import type { GeocodedPlace } from './placeTypes'
import type { PlannedCategory } from './overlays'

export type Intent = {
  status: 'idle' | 'ready' | 'no_place'
  /** Which brief this reading is for, so staleness is derivable, not stateful. */
  forPrompt: string
  /** The word in the prompt we think names the destination. */
  term?: string
  /** The query that actually resolved, which is what callers should re-use. */
  query?: string
  place?: GeocodedPlace
  categories: PlannedCategory[]
}

export const EMPTY_INTENT: Intent = { status: 'idle', forPrompt: '', categories: [] }

const planCategories = async (prompt: string): Promise<PlannedCategory[]> => {
  try {
    const response = await fetch('/api/plan-overlays', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    })
    if (!response.headers.get('content-type')?.includes('application/json')) return []
    const payload = (await response.json()) as { categories?: PlannedCategory[] }
    return payload.categories ?? []
  } catch {
    return []
  }
}

/**
 * Turn a free-text brief into a destination and a list of things to mark,
 * without touching the map.
 *
 * The point is confirmation before commitment: a brief that resolves to the
 * wrong city should be visible as text the user can read and correct, not
 * discovered later in a finished image.
 */
/**
 * Resolve a mention, falling back to the bare term.
 *
 * An acronym is qualified with the place named after it ("DPR" → "DPR
 * Jakarta"), but that neighbour is only a guess: a stopword list will always
 * have gaps, and a bad qualifier turns a findable place into a dead end. If the
 * qualified form misses, try the word on its own before giving up.
 */
const resolveMention = async (mention: { text: string; query: string }) => {
  const qualified = await geocodePlace(mention.query)
  if (qualified.ok) return { place: qualified.place, query: mention.query }
  if (mention.query === mention.text) return null
  const bare = await geocodePlace(mention.text)
  return bare.ok ? { place: bare.place, query: mention.text } : null
}

export const readIntent = async (prompt: string): Promise<Intent> => {
  const mention = extractPlaceMentions(prompt, 1)[0]
  const [resolved, categories] = await Promise.all([
    mention ? resolveMention(mention) : Promise.resolve(null),
    planCategories(prompt),
  ])

  if (!mention) return { status: 'no_place', forPrompt: prompt, categories }
  if (!resolved) return { status: 'no_place', forPrompt: prompt, term: mention.text, categories }
  return { status: 'ready', forPrompt: prompt, term: mention.text, query: resolved.query, place: resolved.place, categories }
}
