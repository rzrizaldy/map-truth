import { verifyOsmExtract } from '../map/fetchExtract'
import { featuresInContext } from '../map/context'
import { getMapRuntime } from '../map/runtime'
import { geocodePlace } from '../map/geocode'
import { geometryHashMatches, geometryHashMatchesSync } from '../lib/hash'
import { exportRouteImage } from '../poster/export'
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
  if (!state.data.lock || !state.data.features.length) {
    addActivity('verify_geography', 'needs_user_action', 'Lock a live OSM viewport first')
    return {
      status: 'needs_user_action',
      reason: 'live_osm_lock_required',
      suggestedAction: 'lock_live_osm',
    }
  }

  // The screenshot handed to the model is only as trustworthy as the geometry
  // that produced it, so re-hash every locked shape against its source. Tile
  // hashes verify synchronously; allocating a promise per feature made this
  // needlessly slow across thousands of shapes.
  const geometryHashMismatches: string[] = []
  const deferred: Array<Promise<void>> = []
  for (const feature of state.data.features) {
    const { id, geometryHash } = feature.properties
    const immediate = geometryHashMatchesSync(feature.geometry, geometryHash)
    if (immediate === null) {
      deferred.push(geometryHashMatches(feature.geometry, geometryHash).then((matches) => {
        if (!matches) geometryHashMismatches.push(id)
      }))
    } else if (!immediate) {
      geometryHashMismatches.push(id)
    }
  }
  await Promise.all(deferred)

  addActivity('verify_geography', geometryHashMismatches.length ? 'error' : 'ok',
    geometryHashMismatches.length
      ? 'Geographic provenance mismatch detected'
      : `${state.data.features.length.toLocaleString()} locked shapes match their source`)

  return {
    status: geometryHashMismatches.length ? 'error' : 'verified',
    allGeographicFeaturesSourceBacked: geometryHashMismatches.length === 0,
    checkedFeatureCount: state.data.features.length,
    geometryHashMismatches,
    truthPins: state.truthPins.map((pin) => ({ name: pin.name, center: pin.center })),
    lockType: state.data.lock.kind,
    lockGeometryHash: state.data.lock.geometryHash,
  } as ToolResult
}

export const exportGroundedArtwork = async (input: { route?: unknown }): Promise<ToolResult> => {
  const route = input.route === 'promptOnly' ? 'promptOnly' : 'screenshotGrounded'
  try {
    const result = await exportRouteImage(route)
    addActivity('export_artwork', 'ok', `Downloaded the ${route === 'promptOnly' ? 'prompt-only' : 'grounded'} image`)
    return { status: 'ready', ...result, attributionIncluded: true }
  } catch (error) {
    addActivity('export_artwork', 'error', 'Nothing generated to download yet')
    return { status: 'needs_user_action', reason: 'nothing_generated_yet', suggestedAction: 'generate_comparison', details: String(error) }
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
