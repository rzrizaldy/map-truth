import { featuresInContext } from './context'
import { hashGeometrySync } from '../lib/hash'
import { addActivity, appStore } from '../state/store'
import { captureUndo } from '../state/history'
import type { GeographyLock, SourceFeature } from '../types/maptruth'

export const verifyOsmExtract = async (bbox: [number, number, number, number]) => {
  const startedAt = performance.now()
  const liveLock = appStore.getState().data.lock
  appStore.setState((state) => ({ data: { ...state.data, verificationStatus: 'verifying', verificationError: undefined } }))
  addActivity('verify_osm_lock', 'ok', 'Canonical OSM verification started in the background', { source: 'manual', beforeHash: liveLock?.geometryHash })

  try {
    const response = await fetch('/api/osm-extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bbox }),
    })
    const payload = (await response.json()) as {
      features?: SourceFeature[]
      place?: string
      error?: string
      suggestedAction?: string
      detail?: string
    }
    if (!response.ok || !payload.features) throw new Error(payload.detail ?? payload.error ?? 'overpass_failed')

    const geometryHash = hashGeometrySync(payload.features.map((feature) => [feature.properties.id, feature.properties.geometryHash]))
    const verifiedLock: GeographyLock = {
      id: `verified:${geometryHash.slice(-10)}`,
      kind: 'verified',
      bbox,
      zoom: appStore.getState().map.zoom,
      sourceRevision: 'openstreetmap-overpass-live',
      geometryHash,
      createdAt: new Date().toISOString(),
      featureCount: payload.features.length,
    }
    captureUndo('canonical OSM verification')
    const seeded = { ...appStore.getState(), data: { ...appStore.getState().data, status: 'ready' as const, features: payload.features, lock: verifiedLock } }
    const renderedFeatureIds = featuresInContext(seeded).map((feature) => feature.properties.id)
    appStore.setState((state) => ({
      data: { status: 'ready', features: payload.features!, lock: verifiedLock, verificationStatus: 'verified' },
      place: { name: payload.place ?? state.place.name, source: 'overpass' },
    }))
    const durationMs = Math.round(performance.now() - startedAt)
    addActivity('verify_osm_lock', 'ok', `${payload.features.length.toLocaleString()} canonical OSM features verified`, {
      source: 'manual', durationMs, beforeHash: liveLock?.geometryHash, afterHash: geometryHash, affectedFeatureIds: renderedFeatureIds.slice(0, 80), reversible: true,
    })
    return { ok: true as const, featureCount: payload.features.length, place: payload.place, geometryHash, durationMs }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'overpass_failed'
    appStore.setState((state) => ({
      data: { ...state.data, status: state.data.features.length ? 'ready' : 'error', verificationStatus: 'error', verificationError: reason },
    }))
    addActivity('verify_osm_lock', 'error', 'Overpass verification failed; the live OSM lock was preserved', {
      source: 'manual', durationMs: Math.round(performance.now() - startedAt), beforeHash: liveLock?.geometryHash,
    })
    return { ok: false as const, reason, suggestedAction: 'retry_verification' }
  }
}

export const fetchOsmExtract = verifyOsmExtract
