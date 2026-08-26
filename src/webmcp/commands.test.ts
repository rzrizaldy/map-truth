import { beforeEach, describe, expect, it } from 'vitest'
import { appStore, DEFAULT_POSTER_SPEC } from '../state/store'
import { hashGeometry, hashGeometrySync } from '../lib/hash'
import type { SourceFeature } from '../types/maptruth'
import { getDrawnGeometry, renderGroundedPoster, validatePosterInput, verifyGeography } from './commands'

const route = {
  type: 'LineString' as const,
  coordinates: [[106.81, -6.20], [106.82, -6.19]],
}

const feature = (id: string, coordinates: [number, number]): SourceFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: {
    id,
    name: id,
    type: 'landmark',
    osmType: 'node',
    osmId: Number(id.replace(/\D/g, '')),
    geometryHash: `hash-${id}`,
  },
})

beforeEach(() => {
  appStore.setState({
    place: { name: 'Central Jakarta–Senayan', source: 'bundled' },
    data: { status: 'ready', features: [feature('osm:a1', [106.815, -6.195]), feature('osm:a2', [106.85, -6.16])] },
    map: { center: [106.82, -6.195], zoom: 12, bbox: [106.785, -6.235, 106.855, -6.155] },
    selection: { kind: 'route', id: 'human:route', geometry: route, geometryHash: hashGeometrySync(route) },
    poster: { spec: { ...DEFAULT_POSTER_SPEC, emphasizedFeatureIds: [] }, status: 'empty', renderedFeatureIds: [], warnings: [] },
    activity: [],
  })
})

describe('grounded commands', () => {
  it('rejects fabricated IDs', () => {
    const result = renderGroundedPoster({ ...DEFAULT_POSTER_SPEC, emphasizedFeatureIds: ['osm:invented'] })
    expect(result).toMatchObject({ status: 'error', reason: 'unknown_feature_ids' })
  })

  it('requires user action for known IDs outside the route buffer', () => {
    const result = renderGroundedPoster({ ...DEFAULT_POSTER_SPEC, emphasizedFeatureIds: ['osm:a2'] })
    expect(result).toMatchObject({ status: 'needs_user_action', reason: 'destination_outside_selected_area' })
  })

  it('never mutates stored human geometry while restyling', () => {
    const before = JSON.stringify(appStore.getState().selection?.geometry)
    const result = renderGroundedPoster({ ...DEFAULT_POSTER_SPEC, emphasizedFeatureIds: ['osm:a1'] })
    expect(result.status).toBe('ok')
    expect(JSON.stringify(appStore.getState().selection?.geometry)).toBe(before)
  })

  it('returns a bounded agent-facing geometry copy', () => {
    const result = getDrawnGeometry()
    expect(result).toMatchObject({ status: 'ok', source: 'human_drawn', geometryHash: hashGeometrySync(route) })
  })

  it('recomputes hashes and reports source geometry mismatches', async () => {
    const inContext = appStore.getState().data.features[0]
    const correctHash = await hashGeometry(inContext.geometry)
    appStore.setState((state) => ({
      data: { ...state.data, features: [{ ...inContext, properties: { ...inContext.properties, geometryHash: correctHash } }] },
      poster: { ...state.poster, status: 'ready', renderedFeatureIds: [inContext.properties.id] },
    }))
    expect(await verifyGeography()).toMatchObject({ status: 'verified', geometryHashMismatches: [] })
    appStore.setState((state) => ({
      data: { ...state.data, features: state.data.features.map((item) => ({ ...item, properties: { ...item.properties, geometryHash: 'tampered' } })) },
    }))
    expect(await verifyGeography()).toMatchObject({ status: 'error', geometryHashMismatches: ['osm:a1'] })
  })

  it('strips control characters and enforces enum validation', () => {
    const result = validatePosterInput({ ...DEFAULT_POSTER_SPEC, title: 'Safe\u0000 title', emphasizedFeatureIds: [] })
    expect(result).toMatchObject({ title: 'Safe title' })
    expect(validatePosterInput({ ...DEFAULT_POSTER_SPEC, preset: 'imaginary' })).toMatchObject({ status: 'error' })
  })
})
