import type { Geometry } from 'geojson'
import { hashGeometrySync } from '../lib/hash'
import type { FeatureClass, GeographyLock, SourceFeature } from '../types/maptruth'

// Bump when the shape of a cached SourceFeature changes. The IndexedDB lock
// cache keys off this, so a stale entry from an older schema (missing `rank`,
// say) can never be served to a returning visitor.
export const LIVE_OSM_SOURCE_REVISION = 'openfreemap-positron-live-v2'

export type ViewportCandidate = {
  source: string
  sourceLayer: string
  layerId?: string
  id?: string | number
  properties?: Record<string, unknown>
  geometry: Geometry
}

const text = (value: unknown) => typeof value === 'string' ? value : undefined
const searchable = (candidate: ViewportCandidate) => [
  candidate.sourceLayer,
  candidate.layerId,
  text(candidate.properties?.class),
  text(candidate.properties?.subclass),
  text(candidate.properties?.highway),
  text(candidate.properties?.leisure),
  text(candidate.properties?.landuse),
  text(candidate.properties?.natural),
  text(candidate.properties?.waterway),
].filter(Boolean).join(' ').toLowerCase()

export const classifyViewportCandidate = (candidate: ViewportCandidate): FeatureClass | null => {
  const haystack = searchable(candidate)
  const geometryType = candidate.geometry.type
  const isLine = geometryType === 'LineString' || geometryType === 'MultiLineString'
  const isArea = geometryType === 'Polygon' || geometryType === 'MultiPolygon'
  const isPoint = geometryType === 'Point' || geometryType === 'MultiPoint'

  if ((/water|river|canal|stream/.test(haystack)) && (isLine || isArea)) return 'water'
  if ((/park|garden|recreation|grass|greenspace/.test(haystack)) && isArea) return 'park'
  if ((/transportation|road|street|highway|motorway|trunk|primary|secondary|tertiary/.test(haystack)) && isLine) return 'road'
  if ((/poi|landmark|museum|historic|place_of_worship|attraction/.test(haystack)) && isPoint && text(candidate.properties?.name)) return 'landmark'
  return null
}

const safePart = (value: string) => value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-|-$/g, '').slice(0, 32) || 'feature'

const eachPosition = (coordinates: unknown, visit: (position: number[]) => boolean): boolean => {
  if (!Array.isArray(coordinates)) return false
  if (typeof coordinates[0] === 'number') return visit(coordinates as number[])
  return (coordinates as unknown[]).some((child) => eachPosition(child, visit))
}

// `querySourceFeatures` returns everything in the loaded tiles, which reach well
// past the visible map. Without this the lock picks up roads the user never saw
// and the overlay shows a hard tile-edge rectangle.
export const intersectsBbox = (geometry: Geometry, bbox: [number, number, number, number]) => {
  if (geometry.type === 'GeometryCollection') return false
  const [west, south, east, north] = bbox
  return eachPosition(geometry.coordinates, ([longitude, latitude]) =>
    longitude >= west && longitude <= east && latitude >= south && latitude <= north)
}

// Roads are the backbone of the picture. A single global cap sorted by draw
// order starved them behind parks and water, so budget each class separately
// and hand any unused share back to the classes that still have candidates.
const CLASS_SHARE: Record<FeatureClass, number> = { road: 0.62, water: 0.14, park: 0.14, landmark: 0.10 }

const ROAD_RANK: Record<string, number> = {
  motorway: 0, trunk: 1, primary: 2, secondary: 3, tertiary: 4,
  motorway_link: 5, trunk_link: 5, primary_link: 5, secondary_link: 5,
  minor: 6, residential: 6, unclassified: 7, living_street: 7,
  service: 9, track: 9, path: 10, footway: 10, cycleway: 10, pedestrian: 8,
}

// Filling the budget in tile-iteration order left whole neighbourhoods bare
// while one corner got every residential lane. Rank by how much of the map a
// feature actually carries, so the kept subset still reads as the same city.
export const candidateRank = (candidate: ViewportCandidate, featureClass: FeatureClass) => {
  const importance = featureClass === 'road'
    ? ROAD_RANK[text(candidate.properties?.class) ?? text(candidate.properties?.highway) ?? ''] ?? 7
    : featureClass === 'water'
      ? (/river|canal/.test(searchable(candidate)) ? 0 : 3)
      : text(candidate.properties?.name) ? 0 : 3
  return importance
}

const spanOf = (geometry: Geometry) => {
  let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity
  eachPosition('coordinates' in geometry ? geometry.coordinates : [], ([longitude, latitude]) => {
    if (longitude < west) west = longitude
    if (longitude > east) east = longitude
    if (latitude < south) south = latitude
    if (latitude > north) north = latitude
    return false
  })
  return east < west ? 0 : (east - west) + (north - south)
}

const applyClassBudget = (features: SourceFeature[], maxFeatures: number): SourceFeature[] => {
  if (features.length <= maxFeatures) return features
  const byClass = new Map<FeatureClass, SourceFeature[]>()
  for (const feature of features) {
    const bucket = byClass.get(feature.properties.type) ?? []
    bucket.push(feature)
    byClass.set(feature.properties.type, bucket)
  }
  const kept: SourceFeature[] = []
  let spare = maxFeatures
  const pending: SourceFeature[][] = []
  for (const [featureClass, bucket] of byClass) {
    bucket.sort((a, b) => (a.properties.rank ?? 9) - (b.properties.rank ?? 9)
      || spanOf(b.geometry) - spanOf(a.geometry)
      || a.properties.id.localeCompare(b.properties.id))
    const quota = Math.floor(maxFeatures * CLASS_SHARE[featureClass])
    const take = Math.min(quota, bucket.length)
    kept.push(...bucket.slice(0, take))
    spare -= take
    if (bucket.length > take) pending.push(bucket.slice(take))
  }
  for (const leftover of pending) {
    if (spare <= 0) break
    const take = Math.min(spare, leftover.length)
    kept.push(...leftover.slice(0, take))
    spare -= take
  }
  return kept
}

export const normalizeViewportFeatures = (
  candidates: ViewportCandidate[],
  sourceRevision = LIVE_OSM_SOURCE_REVISION,
  maxFeatures = 4_000,
  bbox?: [number, number, number, number],
): SourceFeature[] => {
  const deduped = new Map<string, SourceFeature>()

  for (const candidate of candidates) {
    const featureClass = classifyViewportCandidate(candidate)
    if (!featureClass) continue
    if (bbox && !intersectsBbox(candidate.geometry, bbox)) continue
    const geometryHash = hashGeometrySync(candidate.geometry)
    const sourceFeatureId = candidate.id == null ? geometryHash.slice(-8) : String(candidate.id)
    const identity = `${candidate.source}:${candidate.sourceLayer}:${sourceFeatureId}:${geometryHash}`
    if (deduped.has(identity)) continue
    const id = `tile:${safePart(candidate.sourceLayer)}:${safePart(sourceFeatureId)}:${geometryHash.slice(-8)}`
    deduped.set(identity, {
      type: 'Feature',
      id,
      geometry: candidate.geometry,
      properties: {
        id,
        name: text(candidate.properties?.name),
        type: featureClass,
        roadClass: featureClass === 'road'
          ? text(candidate.properties?.class) ?? text(candidate.properties?.highway)
          : undefined,
        sourceKind: 'viewport_tile',
        sourceId: candidate.source,
        sourceLayer: candidate.sourceLayer,
        tileFeatureId: candidate.id == null ? undefined : String(candidate.id),
        sourceRevision,
        rank: candidateRank(candidate, featureClass),
        geometryHash,
      },
    })
  }

  const order: Record<FeatureClass, number> = { park: 0, water: 1, road: 2, landmark: 3 }
  return applyClassBudget([...deduped.values()], maxFeatures)
    .sort((a, b) => order[a.properties.type] - order[b.properties.type] || a.properties.id.localeCompare(b.properties.id))
}

export const createLiveLock = (
  features: SourceFeature[],
  bbox: [number, number, number, number],
  zoom: number,
  sourceRevision = LIVE_OSM_SOURCE_REVISION,
): GeographyLock => {
  const geometryHash = hashGeometrySync(features.map((feature) => [feature.properties.id, feature.properties.geometryHash]))
  return {
    id: `live:${geometryHash.slice(-10)}`,
    kind: 'live',
    bbox,
    zoom,
    sourceRevision,
    geometryHash,
    createdAt: new Date().toISOString(),
    featureCount: features.length,
  }
}

export const liveLockCacheKey = (bbox: [number, number, number, number], zoom: number, revision = LIVE_OSM_SOURCE_REVISION) =>
  `${revision}:${Math.floor(zoom)}:${bbox.map((value) => value.toFixed(4)).join(',')}`
