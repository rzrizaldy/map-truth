import { describe, expect, it } from 'vitest'
import { createLiveLock, liveLockCacheKey, normalizeViewportFeatures, type ViewportCandidate } from './liveOsm'

const road: ViewportCandidate = {
  source: 'openmaptiles', sourceLayer: 'transportation', id: 42,
  properties: { class: 'primary', name: 'Broadway' },
  geometry: { type: 'LineString', coordinates: [[-73.99, 40.75], [-73.98, 40.76]] },
}

describe('live OSM viewport normalization', () => {
  it('classifies and deduplicates loaded tile fragments with traceable IDs', () => {
    const features = normalizeViewportFeatures([
      road,
      road,
      {
        source: 'openmaptiles', sourceLayer: 'water', id: 8,
        properties: { class: 'river', name: 'East River' },
        geometry: { type: 'Polygon', coordinates: [[[-74, 40.7], [-73.9, 40.7], [-73.9, 40.8], [-74, 40.7]]] },
      },
      {
        source: 'openmaptiles', sourceLayer: 'poi', id: 9,
        properties: { class: 'museum', name: 'A Museum' },
        geometry: { type: 'Point', coordinates: [-73.985, 40.748] },
      },
    ])
    expect(features).toHaveLength(3)
    expect(features[0].properties.id).toMatch(/^tile:/)
    expect(features.every((feature) => feature.properties.sourceKind === 'viewport_tile')).toBe(true)
    expect(features.find((feature) => feature.properties.type === 'road')).toMatchObject({ properties: { sourceLayer: 'transportation', tileFeatureId: '42' } })
  })

  it('produces stable lock and cache identities without canonical OSM claims', () => {
    const first = normalizeViewportFeatures([road])
    const second = normalizeViewportFeatures([road])
    const bbox: [number, number, number, number] = [-74.02, 40.72, -73.95, 40.78]
    expect(first[0].properties.id).toBe(second[0].properties.id)
    expect(createLiveLock(first, bbox, 12).geometryHash).toBe(createLiveLock(second, bbox, 12).geometryHash)
    expect(liveLockCacheKey(bbox, 12)).toContain('openfreemap-positron-live-v1')
    expect(first[0].properties.osmId).toBeUndefined()
  })
})
