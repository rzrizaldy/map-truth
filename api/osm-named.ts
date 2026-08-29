import { overpass } from './_lib/overpass.js'
export const config = { maxDuration: 60 }

const json = (value: unknown, init: ResponseInit = {}) => Response.json(value, {
  ...init,
  headers: { 'Cache-Control': 'public, max-age=600, s-maxage=600', ...init.headers },
})

type Element = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

const quote = (value: string) => value.replace(/["\\]/g, '\\$&')

const normalise = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/**
 * Find places by name inside a viewport, using the tags OpenStreetMap actually
 * carries.
 *
 * Nominatim is an address geocoder: asked for "Kopi Aroma" it answers well for
 * streets and towns and poorly for a named shop, which is exactly what a brief
 * about the best cafes is full of. Overpass matches the `name` tag directly,
 * which is where those places live.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { names?: unknown; bbox?: unknown }
  try {
    body = (await request.json()) as { names?: unknown; bbox?: unknown }
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }

  const bbox = Array.isArray(body.bbox) ? body.bbox.map(Number) : []
  if (bbox.length !== 4 || !bbox.every(Number.isFinite)) return json({ error: 'invalid_bbox' }, { status: 400 })
  const [west, south, east, north] = bbox as [number, number, number, number]
  if (west >= east || south >= north) return json({ error: 'invalid_bbox' }, { status: 400 })

  const names = (Array.isArray(body.names) ? body.names : [])
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.replace(/\s+/g, ' ').trim().slice(0, 80))
    .filter((value) => value.length > 1)
    .slice(0, 8)
  if (!names.length) return json({ results: [] })

  const box = `${south},${west},${north},${east}`
  // Exact `name=` matches use Overpass's name index and return in a second. A
  // case-insensitive regex over the same box has to scan every named object and
  // times out, which is what a bbox the size of a city was doing.
  const query = `[out:json][timeout:25];(${
    names.map((name) => `nwr["name"="${quote(name)}"](${box});`).join('')
  });out center tags 60;`

  try {
    const answer = await overpass<Element>(query, 25_000)
    if (!answer.ok) return json({ results: [], error: 'overpass_failed', detail: answer.detail })
    const found = answer.elements
      .map((element) => ({
        name: element.tags?.name ?? '',
        latitude: element.lat ?? element.center?.lat,
        longitude: element.lon ?? element.center?.lon,
        osmId: `osm:${element.type[0]}${element.id}`,
      }))
      .filter((entry) => entry.name && typeof entry.latitude === 'number' && typeof entry.longitude === 'number')

    // Match each suggestion to the closest-named thing Overpass returned, so a
    // request for "Kopi Aroma" cannot be satisfied by an unrelated result that
    // happened to come back in the same batch.
    const results = names.map((name) => {
      const wanted = normalise(name)
      const hit = found.find((entry) => normalise(entry.name) === wanted)
        ?? found.find((entry) => normalise(entry.name).includes(wanted))
      return hit
        ? { query: name, place: { name: hit.name, label: hit.name, center: [hit.longitude!, hit.latitude!] as [number, number], osmId: hit.osmId } }
        : { query: name, place: null }
    })
    return json({ results })
  } catch (error) {
    return json({ results: [], error: 'overpass_failed', detail: error instanceof Error ? error.message : 'unknown' })
  }
}

export function GET(): Response {
  return json({ error: 'method_not_allowed' }, { status: 405 })
}
