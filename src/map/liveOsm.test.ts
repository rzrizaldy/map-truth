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
    expect(liveLockCacheKey(bbox, 12)).toContain('openfreemap-positron-live-v2')
    expect(first[0].properties.osmId).toBeUndefined()
  })
})

describe('viewport budgeting', () => {
  const line = (offset: number): ViewportCandidate => ({
    source: 'openmaptiles', sourceLayer: 'transportation', id: `r${offset}`,
    properties: { class: 'primary' },
    geometry: { type: 'LineString', coordinates: [[106.8 + offset / 1e5, -6.2], [106.81 + offset / 1e5, -6.19]] },
  })
  const park = (offset: number): ViewportCandidate => ({
    source: 'openmaptiles', sourceLayer: 'park', id: `p${offset}`,
    properties: { leisure: 'park' },
    geometry: { type: 'Polygon', coordinates: [[[106.8, -6.2], [106.81, -6.2], [106.81, -6.19 + offset / 1e5], [106.8, -6.2]]] },
  })

  it('never starves roads behind parks when the cap is hit', () => {
    const candidates = [
      ...Array.from({ length: 80 }, (_, index) => park(index)),
      ...Array.from({ length: 80 }, (_, index) => line(index)),
    ]
    const result = normalizeViewportFeatures(candidates, undefined, 100)
    const roads = result.filter((feature) => feature.properties.type === 'road')
    expect(result).toHaveLength(100)
    expect(roads.length).toBeGreaterThanOrEqual(60)
  })

  it('drops features from loaded tiles that lie outside the visible viewport', () => {
    const inside = line(0)
    const outside: ViewportCandidate = {
      source: 'openmaptiles', sourceLayer: 'transportation', id: 'far',
      properties: { class: 'primary' },
      geometry: { type: 'LineString', coordinates: [[120.0, 20.0], [120.1, 20.1]] },
    }
    const result = normalizeViewportFeatures([inside, outside], undefined, 100, [106.79, -6.21, 106.83, -6.18])
    expect(result).toHaveLength(1)
  })
})
