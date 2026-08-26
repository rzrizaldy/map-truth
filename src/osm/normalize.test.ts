import { describe, expect, it } from 'vitest'
import { normalizeOverpassElements } from './normalize'

describe('normalizeOverpassElements', () => {
  it('classifies roads, water, parks, and landmarks with stable osm IDs', () => {
    const features = normalizeOverpassElements([
      {
        type: 'way',
        id: 100,
        tags: { highway: 'primary', name: 'Broadway' },
        geometry: [{ lat: 40.75, lon: -73.99 }, { lat: 40.76, lon: -73.98 }],
      },
      {
        type: 'node',
        id: 200,
        lat: 40.748,
        lon: -73.985,
        tags: { tourism: 'attraction', name: 'Test Landmark' },
      },
    ])

    expect(features).toHaveLength(2)
    expect(features.find((feature) => feature.properties.type === 'road')?.properties.id).toBe('osm:w100')
    expect(features.find((feature) => feature.properties.type === 'landmark')?.properties.geometryHash).toBeTruthy()
  })

  it('drops unnamed minor roads', () => {
    const features = normalizeOverpassElements([
      {
        type: 'way',
        id: 101,
        tags: { highway: 'residential' },
        geometry: [{ lat: 40.75, lon: -73.99 }, { lat: 40.76, lon: -73.98 }],
      },
    ])
    expect(features).toHaveLength(0)
  })
})
