import { verifyOsmExtract } from '../map/fetchExtract'
import { featuresInContext } from '../map/context'
import { getMapRuntime } from '../map/runtime'
import { geocodePlace } from '../map/geocode'
import { geometryHashMatches } from '../lib/hash'
import { exportArtwork } from '../poster/export'
import { addActivity, appStore } from '../state/store'
import { captureUndo } from '../state/history'
import { inspectComparison, stageComparisonForApproval } from '../ai/generation'
import type { ToolResult } from '../types/maptruth'

const cleanText = (value: string, maxLength: number) =>
  [...value]
    .map((character) => {
      const code = character.charCodeAt(0)
      return code < 32 || code === 127 ? ' ' : character
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)

export const getMapContext = (input: { detail?: 'summary' | 'features' } = {}): ToolResult => {
  const state = appStore.getState()
  const contextFeatures = featuresInContext(state)
  const named = contextFeatures.filter((feature) => feature.properties.name)
  const features = input.detail === 'features'
    ? named.slice(0, 20).map(({ properties }) => ({
        id: properties.id,
        name: properties.name,
        type: properties.type,
      }))
    : undefined
  addActivity('inspect_map_context', 'ok', `${contextFeatures.length} source-backed features in context`, { source: 'webmcp' })
  return {
    status: 'ok',
    place: state.place.name,
    placeSource: state.place.source,
    bbox: state.map.bbox.map((value) => Number(value.toFixed(6))),
    hasSelection: Boolean(state.selection),
    featureCount: contextFeatures.length,
    lock: state.data.lock ? {
      id: state.data.lock.id,
      kind: state.data.lock.kind,
      geometryHash: state.data.lock.geometryHash,
      sourceRevision: state.data.lock.sourceRevision,
    } : null,
    verificationStatus: state.data.verificationStatus,
    features,
    truncated: input.detail === 'features' && named.length > 20,
  }
}

export const verifyGeography = async (): Promise<ToolResult> => {
  const state = appStore.getState()
  if (state.poster.status !== 'ready') {
    addActivity('verify_geography', 'needs_user_action', 'Lock a live OSM viewport first')
    return {
      status: 'needs_user_action',
      reason: 'live_osm_lock_required',
      suggestedAction: 'lock_live_osm',
    }
  }
  const sourceIds = new Set(state.data.features.map((feature) => feature.properties.id))
  const unknownFeatureIds = state.poster.renderedFeatureIds.filter((id) => !sourceIds.has(id))
  const renderedIds = new Set(state.poster.renderedFeatureIds)
  const renderedFeatures = state.data.features.filter((feature) => renderedIds.has(feature.properties.id))
  const recomputed = await Promise.all(
    renderedFeatures.map(async (feature) => ({
      id: feature.properties.id,
      matches: await geometryHashMatches(feature.geometry, feature.properties.geometryHash),
    })),
  )
  const geometryHashMismatches = recomputed.filter((result) => !result.matches).map((result) => result.id)
  const mismatches = [...unknownFeatureIds, ...geometryHashMismatches]
  captureUndo('geography comparison mode')
  appStore.setState((current) => ({
    ui: { ...current.ui, comparisonMode: 'overlay', seam: 50 },
  }))
  addActivity('verify_geography', mismatches.length ? 'error' : 'ok',
    mismatches.length ? 'Geographic provenance mismatch detected' : 'Every geographic layer is source-backed')
  return {
    status: mismatches.length ? 'error' : 'verified',
    allGeographicFeaturesSourceBacked: mismatches.length === 0,
    renderedFeatureCount: state.poster.renderedFeatureIds.length,
    humanGeometrySourceBacked: Boolean(state.selection),
    unknownFeatureIds,
    geometryHashMismatches,
    comparisonMode: 'overlay',
    lockType: state.data.lock?.kind ?? 'none',
    lockGeometryHash: state.data.lock?.geometryHash,
  } as ToolResult
}

export const exportGroundedArtwork = async (input: { format?: unknown }): Promise<ToolResult> => {
  if (input.format !== 'png' && input.format !== 'svg') {
    return { status: 'error', reason: 'invalid_export_format' }
  }
  try {
    const result = await exportArtwork(input.format)
    addActivity('export_artwork', 'ok', `Prepared ${input.format.toUpperCase()} download`)
    return { status: 'ready', ...result, attributionIncluded: true }
  } catch (error) {
    addActivity('export_artwork', 'error', 'Export failed')
    return { status: 'error', reason: 'export_failed', details: String(error) }
  }
}

export const lockLiveOsm = async (source: 'manual' | 'webmcp' = 'manual'): Promise<ToolResult> => {
  const runtime = getMapRuntime()
  if (!runtime) return { status: 'needs_user_action', reason: 'map_not_ready', suggestedAction: 'wait_for_map' }
  return runtime.lockLiveOsm(source)
}

export const verifyOsmLock = async (): Promise<ToolResult> => {
  const state = appStore.getState()
  if (!state.data.lock) return { status: 'needs_user_action', reason: 'live_osm_lock_required', suggestedAction: 'lock_live_osm' }
  const result = await verifyOsmExtract(state.data.lock.bbox)
  if (!result.ok) {
    return {
      status: 'needs_user_action',
      reason: result.reason,
      suggestedAction: result.suggestedAction ?? 'retry_verification',
    }
  }
  return {
    status: 'verified',
    featureCount: result.featureCount,
    place: result.place,
    geometryHash: result.geometryHash,
    durationMs: result.durationMs,
    geographySource: 'openstreetmap_overpass_verified',
  }
}

export const navigateMap = async (input: { center?: unknown; zoom?: unknown; label?: unknown }): Promise<ToolResult> => {
  if (!Array.isArray(input.center) || input.center.length !== 2 || input.center.some((value) => typeof value !== 'number' || !Number.isFinite(value))) {
    return { status: 'error', reason: 'invalid_center' }
  }
  const [longitude, latitude] = input.center as [number, number]
  const zoom = Number(input.zoom)
  if (longitude < -180 || longitude > 180 || latitude < -85 || latitude > 85 || !Number.isFinite(zoom) || zoom < 2 || zoom > 18) {
    return { status: 'error', reason: 'invalid_camera' }
  }
  const runtime = getMapRuntime()
  if (!runtime) return { status: 'needs_user_action', reason: 'map_not_ready', suggestedAction: 'wait_for_map' }
  const before = appStore.getState().map
  captureUndo('map navigation')
  await runtime.navigate([longitude, latitude], zoom)
  const label = typeof input.label === 'string' ? cleanText(input.label, 60) : 'Agent-selected viewport'
  appStore.setState((state) => ({ place: { name: label || state.place.name, source: 'none' }, ui: { ...state.ui, canUndo: true } }))
  addActivity('navigate_map', 'ok', `Map moved to ${label}`, {
    source: 'webmcp', beforeHash: `${before.center.join(',')}/${before.zoom}`, afterHash: `${longitude},${latitude}/${zoom}`, reversible: true,
  })
  return { status: 'ok', center: [longitude, latitude], zoom, artworkGeometryChanged: false }
}

/**
 * Move the map to a named place and lock it in one call.
 *
 * `navigate_map` takes raw coordinates, which is useless when the grounding a
 * caller wants is "the place my prompt is about". This is the tool that makes
 * the prompt able to steer the map.
 */
export const focusPlace = async (input: { place?: unknown; lock?: unknown }): Promise<ToolResult> => {
  const query = typeof input.place === 'string' ? cleanText(input.place, 120) : ''
  if (!query) return { status: 'error', reason: 'invalid_place' }
  const runtime = getMapRuntime()
  if (!runtime) return { status: 'needs_user_action', reason: 'map_not_ready', suggestedAction: 'wait_for_map' }

  const outcome = await geocodePlace(query)
  if (!outcome.ok) {
    const reason = outcome.reason === 'not_found' ? 'place_not_found' : 'geocoder_unavailable'
    addActivity('focus_place', 'needs_user_action', outcome.reason === 'not_found'
      ? `No OpenStreetMap place matched "${query}"`
      : 'The place lookup service is unreachable', { source: 'webmcp' })
    return {
      status: 'needs_user_action',
      reason,
      suggestedAction: outcome.reason === 'not_found' ? 'try_a_different_place_name' : 'move_the_map_manually',
    }
  }
  const resolved = outcome.place

  // Nominatim answers "Jakarta" with "Daerah Khusus Ibukota Jakarta". Show the
  // name the user actually used when it is genuinely the same place; the full
  // official label stays on the record.
  const asked = query.trim()
  const displayName = resolved.name.toLowerCase().includes(asked.toLowerCase()) && resolved.name.length > asked.length
    ? asked
    : resolved.name

  captureUndo(`focus on ${displayName}`)
  await runtime.navigate(resolved.center, resolved.zoom)
  appStore.setState((state) => ({
    place: { name: displayName, label: resolved.label, query: asked, center: resolved.center, source: 'geocoded', resolving: false },
    ui: { ...state.ui, canUndo: true },
  }))
  addActivity('focus_place', 'ok', `Map moved to ${resolved.label}`, {
    source: 'webmcp', afterHash: `${resolved.center.join(',')}/${resolved.zoom}`, reversible: true,
  })

  if (input.lock === false) {
    return { status: 'ok', place: displayName, label: resolved.label, center: resolved.center, zoom: resolved.zoom, locked: false }
  }
  const lock = await runtime.lockLiveOsm('webmcp')
  return {
    ...lock,
    place: displayName,
    label: resolved.label,
    center: resolved.center,
    zoom: resolved.zoom,
  } as ToolResult
}

export const generateComparison = (input: { routes?: unknown; prompt?: unknown }): ToolResult => stageComparisonForApproval(input)
export { inspectComparison }
