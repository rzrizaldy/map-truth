import { beforeEach, describe, expect, it } from 'vitest'
import { appStore } from '../state/store'
import { hashGeometry, hashGeometrySync } from '../lib/hash'
import type { SourceFeature } from '../types/maptruth'
import { getMapContext, navigateMap, verifyGeography } from './commands'

const viewport = {
  type: 'Polygon' as const,
  coordinates: [[[106.785, -6.235], [106.855, -6.235], [106.855, -6.155], [106.785, -6.155], [106.785, -6.235]]],
}

const feature = (id: string, coordinates: [number, number]): SourceFeature => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates },
  properties: {
    id,
    name: id,
    type: 'landmark',
    sourceKind: 'openstreetmap',
    osmType: 'node',
    osmId: Number(id.replace(/\D/g, '')),
    geometryHash: `hash-${id}`,
  },
})

beforeEach(() => {
  appStore.setState({
    place: { name: 'Central Jakarta–Senayan', source: 'overpass' },
    data: { status: 'ready', features: [feature('osm:a1', [106.815, -6.195]), feature('osm:a2', [106.82, -6.19])], verificationStatus: 'verified' },
    map: { center: [106.82, -6.195], zoom: 12, bbox: [106.785, -6.235, 106.855, -6.155] },
    selection: { kind: 'area', id: 'human:viewport', geometry: viewport, geometryHash: hashGeometrySync(viewport) },
    truthPins: [],
    activity: [],
  })
})

describe('grounded commands', () => {
  it('returns a bounded, source-backed map context', () => {
    const result = getMapContext({ detail: 'features' }) as Record<string, unknown>
    expect(result).toMatchObject({ status: 'ok', featureCount: 2, placeSource: 'overpass' })
    expect(result.features).toHaveLength(2)
  })

  it('needs a live lock before verifying geography', async () => {
    appStore.setState((state) => ({ data: { ...state.data, lock: undefined } }))
    expect(await verifyGeography()).toMatchObject({
      status: 'needs_user_action',
      reason: 'live_osm_lock_required',
      suggestedAction: 'lock_live_osm',
    })
  })

  it('rejects cameras outside valid longitude, latitude, and zoom', async () => {
    expect(await navigateMap({ center: [999, 0], zoom: 12 })).toMatchObject({ status: 'error', reason: 'invalid_camera' })
    expect(await navigateMap({ center: 'somewhere', zoom: 12 })).toMatchObject({ status: 'error', reason: 'invalid_center' })
    expect(await navigateMap({ center: [0, 0], zoom: 99 })).toMatchObject({ status: 'error', reason: 'invalid_camera' })
  })

  it('recomputes hashes and reports source geometry mismatches', async () => {
    const inContext = appStore.getState().data.features[0]
    const correctHash = await hashGeometry(inContext.geometry)
    appStore.setState((state) => ({
      data: {
        ...state.data,
        features: [{ ...inContext, properties: { ...inContext.properties, geometryHash: correctHash } }],
        lock: {
          id: 'live:x', kind: 'live', bbox: [106.785, -6.235, 106.855, -6.155], zoom: 12,
          sourceRevision: 'r', geometryHash: 'h', createdAt: '', featureCount: 1,
        },
      },
    }))
    expect(await verifyGeography()).toMatchObject({ status: 'verified', geometryHashMismatches: [] })
    appStore.setState((state) => ({
      data: { ...state.data, features: state.data.features.map((item) => ({ ...item, properties: { ...item.properties, geometryHash: 'tampered' } })) },
    }))
    expect(await verifyGeography()).toMatchObject({ status: 'error', geometryHashMismatches: ['osm:a1'] })
  })
})
