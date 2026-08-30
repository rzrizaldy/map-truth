import { overpass } from './_lib/overpass.js'
import { OVERLAY_CATEGORIES, isOverlayCategory, type OverlayCategory } from './_lib/overlay-categories.js'

export const config = { maxDuration: 60 }

const json = (value: unknown, init: ResponseInit = {}) => Response.json(value, {
  ...init,
  headers: { 'Cache-Control': 'no-store', ...init.headers },
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
  // Ranking needs a pool to rank. Overpass applies its own cap before we ever
  // see the results, so asking for six back means getting the first six it
  // happens to find — never the notable ones.
  return `[out:json][timeout:25];(${blocks.join('')});out center tags ${Math.min(1_200, categories.length * 300)};`
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

  const [cx, cy] = [(west + east) / 2, (south + north) / 2]
  const categories = (Array.isArray(body.categories) ? body.categories : [])
    .filter(isOverlayCategory)
    .slice(0, 4) as OverlayCategory[]
  if (!categories.length) return json({ markers: [] })

  try {
    const answer = await overpass<Element>(buildQuery(categories, [west, south, east, north]), 30_000)
    if (!answer.ok) return json({ markers: [], error: 'overpass_failed', detail: answer.detail })
    const perCategory = new Map<OverlayCategory, Array<OverlayMarker & { notable: boolean; distance: number }>>()
    const seen = new Set<string>()

    for (const element of answer.elements) {
      const tags = element.tags ?? {}
      const name = tags.name
      if (!name) continue
      const latitude = element.lat ?? element.center?.lat
      const longitude = element.lon ?? element.center?.lon
      if (typeof latitude !== 'number' || typeof longitude !== 'number') continue

      const category = categories.find((key) => matches(tags, key))
      if (!category) continue
      const key = `${category}:${name.toLowerCase()}`
      if (seen.has(key)) continue
      seen.add(key)

      const bucket = perCategory.get(category) ?? []
      bucket.push({
        category,
        label: OVERLAY_CATEGORIES[category].label,
        colour: OVERLAY_CATEGORIES[category].colour,
        name,
        center: [longitude, latitude],
        // OpenStreetMap carries no fame ranking, but a Wikidata or Wikipedia
        // link is a fair proxy: it is how "iconic landmarks" surfaces the
        // Statue of Liberty rather than the nearest fire-department museum.
        notable: Boolean(tags.wikidata ?? tags.wikipedia),
        // Squared distance from the middle of the locked view. Chasing tag
        // combinations to find "iconic" is endless and city-specific; what
        // reliably matters is that a marker is near the thing being mapped,
        // which also keeps a Jakarta brief from marking the next town over.
        distance: (longitude - cx) ** 2 + (latitude - cy) ** 2,
        osmId: `osm:${element.type[0]}${element.id}`,
      })
      perCategory.set(category, bucket)
    }

    // Six bike docks on one block is worse than four spread along the route:
    // the labels collide and the map says less. Keep them apart.
    const minGap = Math.max(east - west, north - south) * 0.07
    const spread = (candidates: Array<OverlayMarker & { notable: boolean; distance: number }>) => {
      const kept: typeof candidates = []
      for (const candidate of candidates) {
        if (kept.length >= PER_CATEGORY) break
        const crowded = kept.some((other) =>
          Math.abs(other.center[0] - candidate.center[0]) < minGap
          && Math.abs(other.center[1] - candidate.center[1]) < minGap)
        if (!crowded) kept.push(candidate)
      }
      // A tightly clustered category should still show something.
      if (!kept.length && candidates.length) kept.push(candidates[0])
      return kept
    }

    // Keep the requested order so the most important category renders first.
    return json({
      markers: categories.flatMap((key) => spread((perCategory.get(key) ?? [])
        .sort((a, b) => Number(b.notable) - Number(a.notable) || a.distance - b.distance))
        .map(({ notable: _notable, distance: _distance, ...marker }) => marker)),
    })
  } catch (error) {
    return json({ markers: [], error: 'overpass_failed', detail: error instanceof Error ? error.message : 'unknown' })
  }
}

export function GET(): Response {
  return json({ error: 'method_not_allowed' }, { status: 405 })
}
