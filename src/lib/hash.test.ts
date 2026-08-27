import { describe, expect, it } from 'vitest'
import { geometryHashMatches, hashGeometry, hashGeometrySync } from './hash'

const geometry = { type: 'Point', coordinates: [106.82, -6.195] }

describe('geometry hash verification', () => {
  it('verifies live tile hashes with the sync algorithm that produced them', async () => {
    expect(await geometryHashMatches(geometry, hashGeometrySync(geometry))).toBe(true)
  })

  it('verifies canonical OSM hashes with SHA-256', async () => {
    expect(await geometryHashMatches(geometry, await hashGeometry(geometry))).toBe(true)
  })

  it('rejects a tampered hash from either source', async () => {
    expect(await geometryHashMatches(geometry, 'fnv1a:deadbeef')).toBe(false)
    expect(await geometryHashMatches(geometry, 'a'.repeat(64))).toBe(false)
  })
})
