import { describe, expect, it } from 'vitest'
import { geometryToPath, projectPosition, type PosterFrame } from './projection'

const frame: PosterFrame = {
  width: 1200,
  height: 1050,
  padding: 60,
  bounds: [106.785, -6.235, 106.855, -6.155],
}

describe('shared projection', () => {
  it('fits the bounds inside the drawing frame, centred on the short axis', () => {
    const [swX, swY] = projectPosition([106.785, -6.235], frame).map(Math.round)
    const [neX, neY] = projectPosition([106.855, -6.155], frame).map(Math.round)
    // The taller axis touches the padding; the other is inset, not stretched.
    expect(swY).toBe(990)
    expect(neY).toBe(60)
    expect(swX).toBeGreaterThan(60)
    expect(neX).toBeLessThan(1140)
    expect(swX - 60).toBeCloseTo(1140 - neX, 0)
  })

  it('builds deterministic path data', () => {
    const line = { type: 'LineString' as const, coordinates: [[106.8, -6.21], [106.82, -6.19]] }
    expect(geometryToPath(line, frame)).toBe(geometryToPath(line, frame))
    expect(geometryToPath(line, frame)).toMatch(/^M/)
  })
})


describe('shape fidelity', () => {
  // A wide viewport in a near-square poster: the case the studio actually hits.
  const frame: PosterFrame = { width: 1200, height: 1180, padding: 40, bounds: [106.75, -6.23, 106.91, -6.17] }

  // Mercator's own latitude stretch is correct and must survive; what must not
  // survive is the frame adding a second, arbitrary stretch on top of it.
  const mercatorY = (latitude: number) => {
    const radians = (latitude * Math.PI) / 180
    return (1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2
  }

  it('uses one scale for both axes, so nothing is stretched', () => {
    const [x0, y0] = projectPosition([106.79, -6.21], frame)
    const [x1] = projectPosition([106.83, -6.21], frame)
    const [, y1] = projectPosition([106.79, -6.17], frame)

    // Equal spans in Mercator units must produce equal spans in pixels.
    const mercatorSpanX = 0.04 / 360
    const mercatorSpanY = Math.abs(mercatorY(-6.17) - mercatorY(-6.21))
    const pixelsPerUnitX = (x1 - x0) / mercatorSpanX
    const pixelsPerUnitY = (y0 - y1) / mercatorSpanY
    expect(pixelsPerUnitY / pixelsPerUnitX).toBeCloseTo(1, 3)
  })

  it('centres the map instead of anchoring it to a corner', () => {
    const [cx, cy] = projectPosition([(106.75 + 106.91) / 2, (-6.23 + -6.17) / 2], frame)
    expect(cx).toBeCloseTo(frame.width / 2, 0)
    expect(cy).toBeCloseTo(frame.height / 2, 0)
  })

  it('keeps every projected point inside the frame', () => {
    for (const corner of [[106.75, -6.23], [106.91, -6.17], [106.91, -6.23], [106.75, -6.17]] as const) {
      const [x, y] = projectPosition([...corner], frame)
      expect(x).toBeGreaterThanOrEqual(frame.padding - 1)
      expect(x).toBeLessThanOrEqual(frame.width - frame.padding + 1)
      expect(y).toBeGreaterThanOrEqual(frame.padding - 1)
      expect(y).toBeLessThanOrEqual(frame.height - frame.padding + 1)
    }
  })
})
