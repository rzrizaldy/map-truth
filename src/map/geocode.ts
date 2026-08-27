import type { GeocodedPlace } from './placeTypes'

export type GeocodeOutcome =
  | { ok: true; place: GeocodedPlace }
  | { ok: false; reason: 'not_found' | 'unavailable' }

const post = async (body: unknown): Promise<{ places?: GeocodedPlace[]; place?: GeocodedPlace; error?: string } | null> => {
  const response = await fetch('/api/geocode', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  // A dev server without functions answers with the SPA shell, which is not a
  // missing place — telling the user "no such city" would be a lie.
  if (!response.headers.get('content-type')?.includes('application/json')) return null
  const payload = (await response.json()) as { places?: GeocodedPlace[]; place?: GeocodedPlace; error?: string }
  return response.status >= 500 ? null : payload
}

export const geocodePlace = async (query: string): Promise<GeocodeOutcome> => {
  let payload: Awaited<ReturnType<typeof post>>
  try {
    payload = await post({ query })
  } catch {
    return { ok: false, reason: 'unavailable' }
  }
  if (!payload) return { ok: false, reason: 'unavailable' }
  const place = payload.places?.[0]
  return place ? { ok: true, place } : { ok: false, reason: 'not_found' }
}

/** Turn a locked viewport into a human place name. Never blocks the lock. */
export const describeViewport = async (center: [number, number]): Promise<GeocodedPlace | null> => {
  try {
    const payload = await post({ center })
    return payload?.place ?? null
  } catch {
    return null
  }
}
