import { createHash } from 'node:crypto'
import type { Geometry, LineString, MultiLineString, Point, Polygon } from 'geojson'
import type { FeatureClass, SourceFeature } from '../types/maptruth'

const MAJOR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary'])

const stableStringify = (value: unknown) => JSON.stringify(value)
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export type OverpassElement = {
  type: 'node' | 'way' | 'relation'
  id: number
  lat?: number
  lon?: number
  tags?: Record<string, string>
  geometry?: Array<{ lat: number; lon: number }>
}

const osmPrefix = (type: OverpassElement['type']) => (type === 'node' ? 'n' : type === 'way' ? 'w' : 'r')

const wayToGeometry = (geometry: OverpassElement['geometry']): LineString | Polygon | MultiLineString | null => {
  if (!geometry?.length) return null
  const ring = geometry.map(({ lon, lat }) => [lon, lat] as [number, number])
  const closed = ring.length > 3 && ring[0][0] === ring.at(-1)![0] && ring[0][1] === ring.at(-1)![1]
  if (closed && ring.length >= 4) return { type: 'Polygon', coordinates: [ring] }
  return { type: 'LineString', coordinates: ring }
}

const classify = (tags: Record<string, string>, geometryType: string): FeatureClass | null => {
  if (tags.highway && ['LineString', 'MultiLineString', 'Polygon'].includes(geometryType)) {
    if (MAJOR_ROADS.has(tags.highway) || tags.name) return 'road'
    return null
  }
  if ((tags.natural === 'water' || tags.waterway) && geometryType !== 'Point') return 'water'
  if (
    (tags.leisure === 'park' || tags.leisure === 'garden' || tags.landuse === 'recreation_ground' || tags.landuse === 'grass') &&
    ['Polygon', 'MultiPolygon'].includes(geometryType)
  ) {
    return 'park'
  }
  if (
    tags.tourism === 'attraction' ||
    tags.tourism === 'museum' ||
    tags.historic ||
    tags.amenity === 'place_of_worship'
  ) {
    return 'landmark'
  }
  return null
}

const toFeature = (element: OverpassElement, geometry: Geometry, featureClass: FeatureClass): SourceFeature => {
  const id = `osm:${osmPrefix(element.type)}${element.id}`
  const geometryHash = sha256(stableStringify(geometry))
  return {
    type: 'Feature',
    id,
    geometry,
    properties: {
      id,
      name: element.tags?.name,
      type: featureClass,
      roadClass: featureClass === 'road' ? element.tags?.highway : undefined,
      sourceKind: 'openstreetmap',
      osmType: element.type,
      osmId: element.id,
      geometryHash,
    },
  }
}

export const normalizeOverpassElements = (elements: OverpassElement[]): SourceFeature[] => {
  const selected = new Map<string, SourceFeature>()

  for (const element of elements) {
    const tags = element.tags ?? {}
    let geometry: Geometry | null = null

    if (element.type === 'node' && typeof element.lat === 'number' && typeof element.lon === 'number') {
      geometry = { type: 'Point', coordinates: [element.lon, element.lat] } satisfies Point
    } else if (element.geometry?.length) {
      geometry = wayToGeometry(element.geometry)
    }
    if (!geometry) continue

    const featureClass = classify(tags, geometry.type)
    if (!featureClass) continue

    const feature = toFeature(element, geometry, featureClass)
    selected.set(feature.properties.id, feature)
  }

  const order: Record<FeatureClass, number> = { park: 0, water: 1, road: 2, landmark: 3 }
  return [...selected.values()].sort((a, b) => {
    const typeOrder = order[a.properties.type] - order[b.properties.type]
    return typeOrder || a.properties.id.localeCompare(b.properties.id)
  })
}

export const normalizeOsmiumFeatures = (
  features: Array<{ id?: string; geometry?: Geometry; properties?: Record<string, unknown> }>,
  landmarkOverrides?: Map<string, string>,
): SourceFeature[] => {
  const selected = new Map<string, SourceFeature>()

  const add = (raw: { id?: string; geometry?: Geometry; properties?: Record<string, unknown> }, type: FeatureClass, name?: string) => {
    if (!raw.geometry) return
    const sourceId = String(raw.id ?? '')
    const osmType = raw.properties?.['@type'] as 'node' | 'way' | 'relation' | undefined
    const osmId = raw.properties?.['@id'] as number | undefined
    if (!sourceId || !osmType || typeof osmId !== 'number') return
    const id = `osm:${sourceId}`
    selected.set(id, {
      type: 'Feature',
      id,
      geometry: raw.geometry,
      properties: {
        id,
        name: name ?? (typeof raw.properties?.name === 'string' ? raw.properties.name : undefined),
        type,
        roadClass: type === 'road' ? (raw.properties?.highway as string | undefined) : undefined,
        sourceKind: 'openstreetmap',
        osmType,
        osmId,
        geometryHash: sha256(stableStringify(raw.geometry)),
      },
    })
  }

  for (const feature of features) {
    const properties = feature.properties ?? {}
    const geometryType = feature.geometry?.type
    if (properties.highway && ['LineString', 'MultiLineString'].includes(geometryType ?? '')) {
      if (MAJOR_ROADS.has(String(properties.highway)) || properties.name) add(feature, 'road')
      continue
    }
    if ((properties.natural === 'water' || properties.waterway) && geometryType !== 'Point') {
      add(feature, 'water')
      continue
    }
    if (
      (properties.leisure === 'park' || properties.leisure === 'garden' || properties.landuse === 'recreation_ground' || properties.landuse === 'grass') &&
      ['Polygon', 'MultiPolygon'].includes(geometryType ?? '')
    ) {
      add(feature, 'park')
    }
  }

  if (landmarkOverrides) {
    for (const [sourceId, canonicalName] of landmarkOverrides) {
      const raw = features.find((feature) => String(feature.id) === sourceId)
      if (raw) add(raw, 'landmark', canonicalName)
    }
  }

  const order: Record<FeatureClass, number> = { park: 0, water: 1, road: 2, landmark: 3 }
  return [...selected.values()].sort((a, b) => {
    const typeOrder = order[a.properties.type] - order[b.properties.type]
    return typeOrder || a.properties.id.localeCompare(b.properties.id)
  })
}
