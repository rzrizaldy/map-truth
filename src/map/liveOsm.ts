import type { Geometry } from 'geojson'
import { hashGeometrySync } from '../lib/hash'
import type { FeatureClass, GeographyLock, SourceFeature } from '../types/maptruth'

export const LIVE_OSM_SOURCE_REVISION = 'openfreemap-positron-live-v1'

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

export const normalizeViewportFeatures = (
  candidates: ViewportCandidate[],
  sourceRevision = LIVE_OSM_SOURCE_REVISION,
  maxFeatures = 1_600,
): SourceFeature[] => {
  const deduped = new Map<string, SourceFeature>()

  for (const candidate of candidates) {
    const featureClass = classifyViewportCandidate(candidate)
    if (!featureClass) continue
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
        geometryHash,
      },
    })
  }

  const order: Record<FeatureClass, number> = { park: 0, water: 1, road: 2, landmark: 3 }
  return [...deduped.values()]
    .sort((a, b) => order[a.properties.type] - order[b.properties.type] || a.properties.id.localeCompare(b.properties.id))
    .slice(0, maxFeatures)
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
