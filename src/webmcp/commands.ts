import type { LineString, Polygon, Position } from 'geojson'
import { verifyOsmExtract } from '../map/fetchExtract'
import { featuresInContext } from '../map/context'
import { getMapRuntime } from '../map/runtime'
import { hashGeometry } from '../lib/hash'
import { exportArtwork } from '../poster/export'
import { addActivity, appStore } from '../state/store'
import { captureUndo } from '../state/history'
import { inspectComparison, stageComparisonForApproval } from '../ai/generation'
import type {
  LabelDensity,
  PosterPalette,
  PosterPreset,
  RenderPosterInput,
  ToolResult,
} from '../types/maptruth'

const PRESETS = new Set<PosterPreset>(['editorial', 'retro', 'blueprint'])
const PALETTES = new Set<PosterPalette>(['red-cream-black', 'blue-white', 'sunset'])
const LABEL_DENSITIES = new Set<LabelDensity>(['minimal', 'balanced', 'detailed'])

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

const sampleLine = (coordinates: Position[], maxCoordinates = 64): Position[] => {
  if (coordinates.length <= maxCoordinates) return coordinates
  const stride = Math.ceil(coordinates.length / (maxCoordinates - 1))
  const sampled = coordinates.filter((_, index) => index % stride === 0)
  if (sampled.at(-1) !== coordinates.at(-1)) sampled.push(coordinates.at(-1)!)
  return sampled
}

const compactGeometry = (geometry: LineString | Polygon): LineString | Polygon => {
  if (geometry.type === 'LineString') {
    return { type: 'LineString', coordinates: sampleLine(geometry.coordinates) }
  }
  return {
    type: 'Polygon',
    coordinates: geometry.coordinates.map((ring) => sampleLine(ring, 64)),
  }
}

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
    hasDrawnRoute: state.selection?.kind === 'route',
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

export const getDrawnGeometry = (): ToolResult => {
  const selection = appStore.getState().selection
  if (!selection) {
    addActivity('get_drawn_geometry', 'needs_user_action', 'No boundary has been locked yet')
    return {
      status: 'needs_user_action',
      reason: 'no_drawn_geometry',
      suggestedAction: 'lock_live_osm',
    }
  }
  addActivity('get_drawn_geometry', 'ok', `Returned human-drawn ${selection.kind}`)
  return {
    status: 'ok',
    kind: selection.kind,
    geometry: compactGeometry(selection.geometry),
    source: 'human_drawn',
    geometryHash: selection.geometryHash,
  }
}

export const validatePosterInput = (input: unknown): RenderPosterInput | ToolResult => {
  if (!input || typeof input !== 'object') return { status: 'error', reason: 'invalid_input' }
  const value = input as Record<string, unknown>
  if (typeof value.title !== 'string' || !cleanText(value.title, 80)) {
    return { status: 'error', reason: 'invalid_title' }
  }
  if (!PRESETS.has(value.preset as PosterPreset)) return { status: 'error', reason: 'invalid_preset' }
  if (!PALETTES.has(value.palette as PosterPalette)) return { status: 'error', reason: 'invalid_palette' }
  if (!LABEL_DENSITIES.has(value.labelDensity as LabelDensity)) {
    return { status: 'error', reason: 'invalid_label_density' }
  }
  if (!Array.isArray(value.emphasizedFeatureIds) || value.emphasizedFeatureIds.length > 12) {
    return { status: 'error', reason: 'invalid_emphasized_feature_ids' }
  }
  if (value.emphasizedFeatureIds.some((id) => typeof id !== 'string')) {
    return { status: 'error', reason: 'invalid_emphasized_feature_ids' }
  }
  if (typeof value.showLegend !== 'boolean') return { status: 'error', reason: 'invalid_show_legend' }
  if (value.subtitle != null && typeof value.subtitle !== 'string') {
    return { status: 'error', reason: 'invalid_subtitle' }
  }

  return {
    title: cleanText(value.title, 80),
    subtitle: typeof value.subtitle === 'string' ? cleanText(value.subtitle, 140) : undefined,
    preset: value.preset as PosterPreset,
    palette: value.palette as PosterPalette,
    emphasizedFeatureIds: [...new Set(value.emphasizedFeatureIds as string[])],
    labelDensity: value.labelDensity as LabelDensity,
    showLegend: value.showLegend,
  }
}

const isToolError = (value: RenderPosterInput | ToolResult): value is ToolResult =>
  'status' in value

export const renderGroundedPoster = (input: unknown): ToolResult => {
  const state = appStore.getState()
  if (!state.selection) {
    addActivity('render_grounded_poster', 'needs_user_action', 'Create a live OSM lock first')
    return {
      status: 'needs_user_action',
      reason: 'no_area_selected',
      suggestedAction: 'lock_live_osm',
    }
  }
  if (state.data.status !== 'ready' || !state.data.features.length) {
    addActivity('render_grounded_poster', 'needs_user_action', 'Live OpenStreetMap features are not locked')
    return {
      status: 'needs_user_action',
      reason: 'no_area_selected',
      suggestedAction: 'lock_live_osm',
    }
  }
  const validated = validatePosterInput(input)
  if (isToolError(validated)) {
    addActivity('render_grounded_poster', 'error', String(validated.reason))
    return validated
  }

  const allIds = new Set(state.data.features.map((feature) => feature.properties.id))
  const contextFeatures = featuresInContext(state)
  const contextIds = new Set(contextFeatures.map((feature) => feature.properties.id))
  const unknown = validated.emphasizedFeatureIds.filter((id) => !allIds.has(id))
  if (unknown.length) {
    addActivity('render_grounded_poster', 'error', `${unknown.length} fabricated feature ID rejected`)
    return { status: 'error', reason: 'unknown_feature_ids', details: { unknownFeatureIds: unknown } }
  }
  const outside = validated.emphasizedFeatureIds.filter((id) => !contextIds.has(id))
  if (outside.length) {
    addActivity('render_grounded_poster', 'needs_user_action', 'Requested feature is outside the selection')
    return {
      status: 'needs_user_action',
      reason: 'destination_outside_selected_area',
      suggestedAction: 'recenter_or_choose_visible_feature',
    }
  }

  const renderedFeatureIds = contextFeatures.map((feature) => feature.properties.id)
  captureUndo('poster art direction')
  appStore.setState((current) => ({
    poster: {
      ...current.poster,
      spec: validated,
      status: 'ready',
      renderedFeatureIds,
      warnings: [],
    },
  }))
  addActivity('render_grounded_poster', 'ok', `Rendered ${renderedFeatureIds.length} geographic features`)
  return {
    status: 'ok',
    renderedFeatureCount: renderedFeatureIds.length,
    emphasizedFeatureIds: validated.emphasizedFeatureIds,
    preset: validated.preset,
    geographySource: state.data.lock?.kind === 'verified' ? 'openstreetmap_verified_and_human_geometry' : 'live_osm_tiles_and_human_geometry',
  }
}

export const verifyGeography = async (): Promise<ToolResult> => {
  const state = appStore.getState()
  if (state.poster.status !== 'ready') {
    addActivity('verify_geography', 'needs_user_action', 'No poster is ready')
    return {
      status: 'needs_user_action',
      reason: 'render_failed',
      suggestedAction: 'render_grounded_poster',
    }
  }
  const sourceIds = new Set(state.data.features.map((feature) => feature.properties.id))
  const unknownFeatureIds = state.poster.renderedFeatureIds.filter((id) => !sourceIds.has(id))
  const renderedIds = new Set(state.poster.renderedFeatureIds)
  const renderedFeatures = state.data.features.filter((feature) => renderedIds.has(feature.properties.id))
  const recomputed = await Promise.all(
    renderedFeatures.map(async (feature) => ({
      id: feature.properties.id,
      matches: (await hashGeometry(feature.geometry)) === feature.properties.geometryHash,
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

export const generateComparison = (input: { routes?: unknown; prompt?: unknown }): ToolResult => stageComparisonForApproval(input)
export { inspectComparison }

// Compatibility alias for older manual and agent clients.
export const lockMapBoundary = lockLiveOsm
