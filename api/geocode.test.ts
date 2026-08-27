import { describe, expect, it } from 'vitest'
import { GET, zoomForBbox, MIN_FOCUS_ZOOM, toGeocodedPlace } from './geocode'
import { liveBboxSpanOk } from '../src/map/boundary.js'

// The widest viewport we expect to serve, in CSS pixels.
const spanAtZoom = (zoom: number, widthPx = 2560) => (widthPx * 360) / (512 * 2 ** zoom)

describe('focus zoom', () => {
  it('never frames a city so wide that the live lock would reject it', () => {
    // Jakarta's administrative bbox, which spans more than a degree.
    const zoom = zoomForBbox([106.3146732, -6.3744575, 106.973975, -4.9993635])
    expect(zoom).toBeGreaterThanOrEqual(MIN_FOCUS_ZOOM)
    const span = spanAtZoom(zoom)
    expect(liveBboxSpanOk([0, 0, span, span])).toBe(true)
  })

  it('stays close for a small place', () => {
    expect(zoomForBbox([2.335, 48.859, 2.339, 48.862])).toBeGreaterThan(MIN_FOCUS_ZOOM)
  })

  it('caps how far it will ever zoom in', () => {
    expect(zoomForBbox([2.3364, 48.8606, 2.3364001, 48.8606001])).toBeLessThanOrEqual(16)
  })
})

describe('geocode result mapping', () => {
  it('converts a Nominatim result into a usable camera', () => {
    const place = toGeocodedPlace({
      name: 'Jakarta', display_name: 'Jakarta, Indonesia',
      lat: '-6.1754049', lon: '106.827168',
      boundingbox: ['-6.3744575', '-4.9993635', '106.3146732', '106.973975'],
      addresstype: 'city',
    })
    expect(place).toMatchObject({ name: 'Jakarta', center: [106.827168, -6.1754049], kind: 'city' })
  })

  it('rejects a result without usable coordinates', () => {
    expect(toGeocodedPlace({ display_name: 'Nowhere' })).toBeNull()
  })

  it('refuses non-POST requests', () => {
    expect(GET().status).toBe(405)
  })
})
