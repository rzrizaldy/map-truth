import { describe, expect, it } from 'vitest'
import { geometryToPath, projectPosition, type PosterFrame } from './projection'

const frame: PosterFrame = {
  width: 1200,
  height: 1050,
  padding: 60,
  bounds: [106.785, -6.235, 106.855, -6.155],
}

describe('shared projection', () => {
  it('projects the geographic bounds to the exact drawing frame', () => {
    expect(projectPosition([106.785, -6.235], frame).map(Math.round)).toEqual([60, 990])
    expect(projectPosition([106.855, -6.155], frame).map(Math.round)).toEqual([1140, 60])
  })

  it('builds deterministic path data', () => {
    const line = { type: 'LineString' as const, coordinates: [[106.8, -6.21], [106.82, -6.19]] }
    expect(geometryToPath(line, frame)).toBe(geometryToPath(line, frame))
    expect(geometryToPath(line, frame)).toMatch(/^M/)
  })
})

