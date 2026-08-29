import type { GeocodedPlace } from '../src/map/placeTypes.js'

export const config = { maxDuration: 60 }

type GeocodeRequest = { query?: unknown; queries?: unknown; center?: unknown; within?: unknown }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type NominatimPlace = {
  display_name?: string
  name?: string
  lat?: string
  lon?: string
  boundingbox?: [string, string, string, string]
  addresstype?: string
  type?: string
}


const json = (value: unknown, init: ResponseInit = {}) => Response.json(value, {
  ...init,
  // Geocoding the same place repeatedly is wasteful and Nominatim asks callers
  // to cache; a day is far shorter than a city moves.
  headers: { 'Cache-Control': 'public, max-age=86400, s-maxage=86400', ...init.headers },
})

const CONTACT = 'MapTruth/1.0 (https://map-truth.vercel.app)'

/**
 * Turn a Nominatim bbox into a camera zoom.
 *
 * The floor matters: an administrative area like "Daerah Khusus Ibukota
 * Jakarta" has a bbox spanning well over a degree, and framing all of it would
 * put the viewport past the span the live lock accepts — focusing a big city
 * would move the map and then refuse to lock it. A district-scale view is both
 * lockable and what someone asking for a city poster actually wants.
 */
export const MIN_FOCUS_ZOOM = 12.5
// A single building's bbox is metres across. Framing it exactly leaves a poster
// with one roof and no city around it, so keep some neighbourhood in view.
export const MAX_FOCUS_ZOOM = 14.6

export const zoomForBbox = ([west, south, east, north]: [number, number, number, number]) => {
  const span = Math.max(east - west, (north - south) * 1.6)
  if (!Number.isFinite(span) || span <= 0) return 14
  const zoom = Math.log2(360 / span) + 0.4
  return Math.min(MAX_FOCUS_ZOOM, Math.max(MIN_FOCUS_ZOOM, Number(zoom.toFixed(2))))
}

export const toGeocodedPlace = (place: NominatimPlace): GeocodedPlace | null => {
  const latitude = Number(place.lat)
  const longitude = Number(place.lon)
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null
  const box = place.boundingbox?.map(Number)
  const bbox: [number, number, number, number] = box && box.length === 4 && box.every(Number.isFinite)
    ? [box[2], box[0], box[3], box[1]]
    : [longitude - 0.05, latitude - 0.04, longitude + 0.05, latitude + 0.04]
  const label = place.display_name ?? place.name ?? 'Unnamed place'
  return {
    name: place.name || label.split(',')[0].trim(),
    label,
    center: [longitude, latitude],
    bbox,
    zoom: zoomForBbox(bbox),
    kind: place.addresstype ?? place.type ?? 'place',
  }
}

const nominatim = async (path: string) => {
  // Without this Nominatim answers in the local language — Kyoto comes back as
  // 京都市, which an English interface cannot match against the prompt.
  const response = await fetch(`https://nominatim.openstreetmap.org${path}&accept-language=en`, {
    headers: { 'User-Agent': CONTACT, Referer: 'https://map-truth.vercel.app', Accept: 'application/json' },
    signal: AbortSignal.timeout(12_000),
  })
  if (!response.ok) throw new Error(`nominatim_http_${response.status}`)
  return response.json() as Promise<unknown>
}

export async function POST(request: Request): Promise<Response> {
  let body: GeocodeRequest
  try {
    body = (await request.json()) as GeocodeRequest
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }

  // Reverse: turn a locked viewport into a human place name.
  if (Array.isArray(body.center)) {
    const [longitude, latitude] = body.center.map(Number)
    if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
      return json({ error: 'invalid_center' }, { status: 400 })
    }
    try {
      const payload = (await nominatim(`/reverse?format=jsonv2&zoom=12&lat=${latitude}&lon=${longitude}`)) as NominatimPlace
      const place = toGeocodedPlace(payload)
      if (!place) return json({ error: 'place_not_found' }, { status: 404 })
      return json({ place })
    } catch (error) {
      return json({ error: 'geocode_failed', detail: error instanceof Error ? error.message : 'unknown' }, { status: 502 })
    }
  }

  // `within` restricts the search to the locked viewport, which is how "DPR"
  // resolves to the parliament building in Jakarta instead of a road with the
  // same initials on another continent.
  let bounded = ''
  if (Array.isArray(body.within) && body.within.length === 4) {
    const box = body.within.map(Number)
    if (box.every(Number.isFinite)) {
      const [west, south, east, north] = box
      bounded = `&viewbox=${west},${north},${east},${south}&bounded=1`
    }
  }

  // Several names at once, resolved here rather than as parallel calls from the
  // browser: Nominatim asks for at most one request a second, and a handful of
  // simultaneous lookups earns a rate limit instead of answers.
  if (Array.isArray(body.queries)) {
    const queries = body.queries
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.trim().slice(0, 120))
      .filter(Boolean)
      .slice(0, 8)
    const results: Array<{ query: string; place: GeocodedPlace | null }> = []
    for (const [index, name] of queries.entries()) {
      if (index > 0) await wait(1_100)
      try {
        const payload = (await nominatim(`/search?format=jsonv2&limit=1${bounded}&q=${encodeURIComponent(name)}`)) as NominatimPlace[]
        const place = (Array.isArray(payload) ? payload : []).map(toGeocodedPlace).find((value) => value !== null) ?? null
        results.push({ query: name, place })
      } catch {
        results.push({ query: name, place: null })
      }
    }
    return json({ results })
  }

  const query = typeof body.query === 'string' ? body.query.trim().slice(0, 120) : ''
  if (!query) return json({ error: 'query_required' }, { status: 400 })

  try {
    const payload = (await nominatim(`/search?format=jsonv2&limit=5&q=${encodeURIComponent(query)}${bounded}`)) as NominatimPlace[]
    const places = (Array.isArray(payload) ? payload : []).map(toGeocodedPlace).filter((place): place is GeocodedPlace => place !== null)
    if (!places.length) return json({ error: 'place_not_found', query }, { status: 404 })
    return json({ query, places })
  } catch (error) {
    return json({ error: 'geocode_failed', detail: error instanceof Error ? error.message : 'unknown' }, { status: 502 })
  }
}

export function GET(): Response {
  return json({ error: 'method_not_allowed' }, { status: 405 })
}
