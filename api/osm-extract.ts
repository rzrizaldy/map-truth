import { overpass } from './_lib/overpass.js'
import { bboxSpanOk, formatPlaceLabel } from '../src/map/boundary.js'
import { normalizeOverpassElements, type OverpassElement } from '../src/osm/normalize.js'

export const config = { maxDuration: 60 }

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

// Vercel treats a default export as the Node `(req, res)` signature and ignores
// any returned Response. Named HTTP method exports keep the Web handler shape.
export async function POST(request: Request): Promise<Response> {
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
    const answer = await overpass<OverpassElement>(overpassQuery(south, west, north, east))
    if (!answer.ok) return json({ error: 'overpass_failed', detail: answer.detail }, { status: 502 })

    const features = normalizeOverpassElements(answer.elements)

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

export function GET(): Response {
  return json({ error: 'method_not_allowed' }, { status: 405 })
}
