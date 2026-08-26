import { bboxSpanOk, formatPlaceLabel } from '../src/map/boundary'
import { normalizeOverpassElements, type OverpassElement } from '../src/osm/normalize'

export const config = { maxDuration: 30 }

type ExtractRequest = { bbox?: unknown }

const json = (value: unknown, init: ResponseInit = {}) =>
  Response.json(value, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  })

const overpassQuery = (south: number, west: number, north: number, east: number) => `
[out:json][timeout:25];
(
  way["highway"~"^(motorway|trunk|primary|secondary|tertiary)$"](${south},${west},${north},${east});
  way["highway"]["name"](${south},${west},${north},${east});
  nwr["natural"="water"](${south},${west},${north},${east});
  nwr["waterway"~"^(river|canal|stream)$"](${south},${west},${north},${east});
  nwr["leisure"~"^(park|garden)$"](${south},${west},${north},${east});
  nwr["landuse"~"^(recreation_ground|grass)$"](${south},${west},${north},${east});
  nwr["tourism"~"^(attraction|museum)$"](${south},${west},${north},${east});
  nwr["historic"](${south},${west},${north},${east});
  nwr["amenity"="place_of_worship"](${south},${west},${north},${east});
);
out geom;
`.trim()

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 })

  let body: ExtractRequest
  try {
    body = (await request.json()) as ExtractRequest
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!Array.isArray(body.bbox) || body.bbox.length !== 4) {
    return json({ error: 'bbox_required' }, { status: 400 })
  }

  const bbox = body.bbox.map((value) => Number(value)) as [number, number, number, number]
  if (bbox.some((value) => !Number.isFinite(value))) {
    return json({ error: 'invalid_bbox' }, { status: 400 })
  }

  const [west, south, east, north] = bbox
  if (west >= east || south >= north) {
    return json({ error: 'invalid_bbox' }, { status: 400 })
  }

  if (!bboxSpanOk(bbox)) {
    return json({ error: 'bbox_too_large', suggestedAction: 'zoom_in' }, { status: 400 })
  }

  try {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MapTruth/1.0 (https://map-truth.vercel.app)',
      },
      body: `data=${encodeURIComponent(overpassQuery(south, west, north, east))}`,
      signal: AbortSignal.timeout(25_000),
    })

    if (!response.ok) {
      return json({ error: 'overpass_failed', detail: `HTTP ${response.status}` }, { status: 502 })
    }

    const payload = (await response.json()) as { elements?: OverpassElement[] }
    const features = normalizeOverpassElements(payload.elements ?? [])

    if (!features.length) {
      return json({ error: 'no_features_in_bbox', suggestedAction: 'zoom_in_or_pan' }, { status: 404 })
    }

    return json({
      place: formatPlaceLabel(bbox),
      bbox,
      featureCount: features.length,
      features,
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'overpass_request_failed'
    return json({ error: 'overpass_failed', detail }, { status: 502 })
  }
}
