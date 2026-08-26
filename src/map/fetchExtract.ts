import { bboxToPolygon } from './boundary'
import { featuresInContext } from './context'
import { hashGeometrySync } from '../lib/hash'
import { addActivity, appStore } from '../state/store'
import type { SourceFeature } from '../types/maptruth'

export const fetchOsmExtract = async (bbox: [number, number, number, number]) => {
  const polygon = bboxToPolygon(bbox)
  const geometryHash = hashGeometrySync(polygon)

  appStore.setState((state) => ({
    data: { status: 'loading', features: [], error: undefined },
    selection: { kind: 'area', id: 'human:boundary', geometry: polygon, geometryHash },
    poster: { ...state.poster, status: 'empty', renderedFeatureIds: [], warnings: [] },
  }))
  addActivity('lock_boundary', 'ok', 'Fetching OpenStreetMap vectors for the current view')

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

  if (!response.ok || !payload.features) {
    const reason = payload.error ?? 'extract_failed'
    appStore.setState(() => ({
      data: { status: 'error', features: [], error: payload.detail ?? reason },
    }))
    addActivity('lock_boundary', 'error', reason)
    return { ok: false as const, reason, suggestedAction: payload.suggestedAction }
  }

  const seededState = {
    ...appStore.getState(),
    data: { status: 'ready' as const, features: payload.features },
    selection: { kind: 'area' as const, id: 'human:boundary', geometry: polygon, geometryHash },
  }
  const renderedFeatureIds = featuresInContext(seededState).map((feature) => feature.properties.id)

  appStore.setState((state) => ({
    data: { status: 'ready', features: payload.features! },
    place: { name: payload.place ?? state.place.name, source: 'overpass' },
    poster: { ...state.poster, status: 'ready', renderedFeatureIds },
  }))
  addActivity('lock_boundary', 'ok', `${payload.features.length.toLocaleString()} OSM features locked`)

  return { ok: true as const, featureCount: payload.features.length, place: payload.place }
}
