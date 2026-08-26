import type { LineString, Polygon, Position } from 'geojson'
import { bboxSpanOk } from '../map/boundary'
import { fetchOsmExtract } from '../map/fetchExtract'
import { featuresInContext } from '../map/context'
import { hashGeometry } from '../lib/hash'
import { exportArtwork } from '../poster/export'
import { addActivity, appStore } from '../state/store'
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
  addActivity('get_map_context', 'ok', `${contextFeatures.length} source-backed features in context`)
  return {
    status: 'ok',
    place: state.place.name,
    placeSource: state.place.source,
    bbox: state.map.bbox.map((value) => Number(value.toFixed(6))),
    hasSelection: Boolean(state.selection),
    hasDrawnRoute: state.selection?.kind === 'route',
    featureCount: contextFeatures.length,
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
      suggestedAction: 'lock_map_boundary',
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
    addActivity('render_grounded_poster', 'needs_user_action', 'Lock a map boundary first')
    return {
      status: 'needs_user_action',
      reason: 'no_area_selected',
      suggestedAction: 'lock_map_boundary',
    }
  }
  if (state.data.status !== 'ready' || !state.data.features.length) {
    addActivity('render_grounded_poster', 'needs_user_action', 'OpenStreetMap extract not loaded')
    return {
      status: 'needs_user_action',
      reason: 'no_area_selected',
      suggestedAction: 'lock_map_boundary',
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
    geographySource: 'osm_and_human_geometry',
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

export const lockMapBoundary = async (): Promise<ToolResult> => {
  const { map } = appStore.getState()
  if (!bboxSpanOk(map.bbox)) {
    addActivity('lock_map_boundary', 'needs_user_action', 'Viewport is too large — zoom in')
    return {
      status: 'needs_user_action',
      reason: 'bbox_too_large',
      suggestedAction: 'zoom_in',
    }
  }

  const result = await fetchOsmExtract(map.bbox)
  if (!result.ok) {
    return {
      status: 'needs_user_action',
      reason: result.reason,
      suggestedAction: result.suggestedAction ?? 'zoom_in',
    }
  }

  return {
    status: 'ok',
    featureCount: result.featureCount,
    place: result.place,
    geographySource: 'openstreetmap_overpass',
  }
}
