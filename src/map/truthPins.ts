import { extractPlaceMentions } from './places'
import type { GeocodedPlace } from './placeTypes'

export type TruthPin = {
  term: string
  name: string
  label: string
  center: [number, number]
}

const insideBbox = ([longitude, latitude]: [number, number], [west, south, east, north]: [number, number, number, number]) =>
  longitude >= west && longitude <= east && latitude >= south && latitude <= north

/**
 * Terms worth looking up as things on the map, given where the map already is.
 *
 * The locked place itself is excluded: with the map on Jakarta, "Jakarta" would
 * otherwise pin every road named after the city instead of the thing the brief
 * is actually about.
 */
export const pinnableTerms = (prompt: string, placeNames: Array<string | undefined>): string[] => {
  const known = placeNames.filter(Boolean).map((name) => name!.toLowerCase())
  return extractPlaceMentions(prompt, 6)
    .map((mention) => mention.query)
    .filter((term) => {
      const lower = term.toLowerCase()
      return !known.some((name) => name.includes(lower) || lower.includes(name))
    })
    .slice(0, 3)
}

type Lookup = (query: string, within: [number, number, number, number]) => Promise<GeocodedPlace | null>

/** Resolve prompt terms to real OSM coordinates inside the locked viewport. */
export const resolveTruthPins = async (
  prompt: string,
  placeNames: Array<string | undefined>,
  bbox: [number, number, number, number],
  lookup: Lookup,
): Promise<TruthPin[]> => {
  const terms = pinnableTerms(prompt, placeNames)
  if (!terms.length) return []

  const found = await Promise.all(terms.map(async (term) => {
    const place = await lookup(term, bbox)
    if (!place || !insideBbox(place.center, bbox)) return null
    return { term, name: place.name, label: place.label, center: place.center }
  }))
  return found.filter((pin): pin is TruthPin => pin !== null)
}
