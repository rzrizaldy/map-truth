import { render } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'
import { appStore, DEFAULT_POSTER_SPEC } from '../state/store'
import { PosterSvg } from './PosterSvg'
import type { SourceFeature } from '../types/maptruth'

const source: SourceFeature = {
  type: 'Feature',
  geometry: { type: 'LineString', coordinates: [[106.8, -6.20], [106.82, -6.19]] },
  properties: { id: 'osm:a99', name: '<script>alert(1)</script>', type: 'road', sourceKind: 'openstreetmap', osmType: 'way', osmId: 99, geometryHash: 'source-hash-99' },
}

beforeEach(() => {
  appStore.setState({
    place: { name: 'Test place', source: 'overpass' },
    data: { status: 'ready', features: [source], verificationStatus: 'verified' },
    map: { center: [106.81, -6.195], zoom: 12, bbox: [106.785, -6.235, 106.855, -6.155] },
    selection: undefined,
    poster: { spec: { ...DEFAULT_POSTER_SPEC, title: '<img src=x onerror=alert(1)>', emphasizedFeatureIds: [] }, status: 'ready', renderedFeatureIds: ['osm:a99'], warnings: [] },
  })
})

describe('poster SVG provenance', () => {
  it('records feature IDs, hashes, and attribution without unsafe markup', () => {
    const { container } = render(<PosterSvg id="maptruth-poster-svg" />)
    const path = container.querySelector('[data-source-id="osm:a99"]')
    expect(path).toHaveAttribute('data-geometry-hash', 'source-hash-99')
    expect(container.textContent).toContain('MAP DATA © OPENSTREETMAP CONTRIBUTORS')
    expect(container.querySelector('script')).toBeNull()
    expect(container.querySelector('img')).toBeNull()
    expect(container.innerHTML).toContain('&lt;IMG SRC=X ONERROR=ALERT(1)&gt;')
  })

  it('renders an OSM-backed legend only when showLegend is true', () => {
    const shown = render(<PosterSvg id="legend-on" />)
    expect(shown.container.querySelector('[data-legend="osm-layers"]')).not.toBeNull()
    expect(shown.container.querySelector('[data-legend-item="road"]')).not.toBeNull()
    shown.unmount()

    appStore.setState((state) => ({
      poster: { ...state.poster, spec: { ...state.poster.spec, showLegend: false } },
    }))
    const hidden = render(<PosterSvg id="legend-off" />)
    expect(hidden.container.querySelector('[data-legend="osm-layers"]')).toBeNull()
  })
})
