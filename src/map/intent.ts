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
export const readIntent = async (prompt: string): Promise<Intent> => {
  const mention = extractPlaceMentions(prompt, 1)[0]
  const [place, categories] = await Promise.all([
    mention ? geocodePlace(mention.query) : Promise.resolve(null),
    planCategories(prompt),
  ])

  if (!mention) return { status: 'no_place', forPrompt: prompt, categories }
  if (!place || !place.ok) return { status: 'no_place', forPrompt: prompt, term: mention.text, categories }
  return { status: 'ready', forPrompt: prompt, term: mention.text, place: place.place, categories }
}
