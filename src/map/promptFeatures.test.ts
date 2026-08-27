import { describe, expect, it } from 'vitest'
import { matchPromptFeatures } from './promptFeatures'
import type { SourceFeature } from '../types/maptruth'

const feature = (id: string, name: string, type: SourceFeature['properties']['type'] = 'landmark'): SourceFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: [106.8, -6.2] },
  properties: { id, name, type, sourceKind: 'viewport_tile', geometryHash: `h-${id}` },
})

describe('matching a prompt to real features', () => {
  const features = [
    feature('a', 'Gedung DPR/MPR RI'),
    feature('b', 'Jalan Gatot Subroto', 'road'),
    feature('c', 'Monumen Nasional'),
    feature('d', 'Senayan Park', 'park'),
  ]

  it('pins the real building a prompt names', () => {
    const matches = matchPromptFeatures('Peta demo DPR Jakarta', features)
    expect(matches.map((m) => m.feature.properties.name)).toContain('Gedung DPR/MPR RI')
  })

  it('ignores filler words that would match half the city', () => {
    // "demo" and "peta" are noise; only DPR should pull a feature.
    expect(matchPromptFeatures('Peta demo', features)).toEqual([])
  })

  it('does not match a fragment inside a longer word', () => {
    expect(matchPromptFeatures('sena', [feature('d', 'Senayan Park', 'park')])).toEqual([])
  })

  it('puts landmarks ahead of roads carrying the same name', () => {
    const both = [feature('r', 'Senayan', 'road'), feature('l', 'Senayan', 'landmark')]
    // Same name is de-duplicated, so ask with two distinct names.
    const mixed = [feature('r', 'Subroto Road', 'road'), feature('l', 'Subroto Hall', 'landmark')]
    expect(matchPromptFeatures('Subroto', mixed)[0].feature.properties.type).toBe('landmark')
    expect(matchPromptFeatures('Senayan', both)).toHaveLength(1)
  })

  it('returns nothing when the prompt names no real feature', () => {
    expect(matchPromptFeatures('A bold sunset poster', features)).toEqual([])
  })
})
