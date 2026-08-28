import { OVERLAY_CATEGORIES, isOverlayCategory, type OverlayCategory } from './_lib/overlay-categories.js'

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

export type OverlayMarker = {
  category: OverlayCategory
  label: string
  colour: string
  name: string
  center: [number, number]
  osmId: string
}

// Enough to make a map useful, few enough to stay readable once rendered.
const PER_CATEGORY = 6

const buildQuery = (categories: OverlayCategory[], [west, south, east, north]: [number, number, number, number]) => {
  const box = `${south},${west},${north},${east}`
  const blocks = categories.flatMap((category) =>
    OVERLAY_CATEGORIES[category].filters.map((filter) => `nwr${filter}(${box});`))
  return `[out:json][timeout:25];(${blocks.join('')});out center tags ${categories.length * PER_CATEGORY * 12};`
}

const matches = (tags: Record<string, string>, category: OverlayCategory) =>
  OVERLAY_CATEGORIES[category].filters.some((filter) => {
    const pair = filter.match(/\["([^"]+)"="([^"]+)"\]/)
    return pair ? tags[pair[1]] === pair[2] : false
  })

export async function POST(request: Request): Promise<Response> {
  let body: { bbox?: unknown; categories?: unknown }
  try {
    body = (await request.json()) as { bbox?: unknown; categories?: unknown }
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }

  const bbox = Array.isArray(body.bbox) ? body.bbox.map(Number) : []
  if (bbox.length !== 4 || !bbox.every(Number.isFinite)) return json({ error: 'invalid_bbox' }, { status: 400 })
  const [west, south, east, north] = bbox as [number, number, number, number]
  if (west >= east || south >= north) return json({ error: 'invalid_bbox' }, { status: 400 })
  if (east - west > 0.6 || north - south > 0.6) return json({ error: 'bbox_too_large' }, { status: 400 })

  const categories = (Array.isArray(body.categories) ? body.categories : [])
    .filter(isOverlayCategory)
    .slice(0, 4) as OverlayCategory[]
  if (!categories.length) return json({ markers: [] })

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MapTruth/1.0 (https://map-truth.vercel.app)',
      },
      body: `data=${encodeURIComponent(buildQuery(categories, [west, south, east, north]))}`,
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) return json({ markers: [], error: 'overpass_failed', detail: `HTTP ${response.status}` })

    const payload = (await response.json()) as { elements?: Element[] }
    const perCategory = new Map<OverlayCategory, OverlayMarker[]>()
    const seen = new Set<string>()

    for (const element of payload.elements ?? []) {
      const tags = element.tags ?? {}
      const name = tags.name
      if (!name) continue
      const latitude = element.lat ?? element.center?.lat
      const longitude = element.lon ?? element.center?.lon
      if (typeof latitude !== 'number' || typeof longitude !== 'number') continue

      const category = categories.find((key) => matches(tags, key))
      if (!category) continue
      const bucket = perCategory.get(category) ?? []
      if (bucket.length >= PER_CATEGORY) continue
      const key = `${category}:${name.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)

      bucket.push({
        category,
        label: OVERLAY_CATEGORIES[category].label,
        colour: OVERLAY_CATEGORIES[category].colour,
        name,
        center: [longitude, latitude],
        osmId: `osm:${element.type[0]}${element.id}`,
      })
      perCategory.set(category, bucket)
    }

    // Keep the requested order so the most important category renders first.
    return json({ markers: categories.flatMap((key) => perCategory.get(key) ?? []) })
  } catch (error) {
    return json({ markers: [], error: 'overpass_failed', detail: error instanceof Error ? error.message : 'unknown' })
  }
}

export function GET(): Response {
  return json({ error: 'method_not_allowed' }, { status: 405 })
}
