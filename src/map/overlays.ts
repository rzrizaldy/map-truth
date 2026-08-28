import { addActivity, appStore } from '../state/store'

export type OverlayMarker = {
  category: string
  label: string
  colour: string
  name: string
  center: [number, number]
  osmId: string
}

export type PlannedCategory = { key: string; label: string; colour: string }

const postJson = async <T>(url: string, body: unknown): Promise<T | null> => {
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!response.headers.get('content-type')?.includes('application/json')) return null
    return (await response.json()) as T
  } catch {
    return null
  }
}

let inFlight = ''

/**
 * Work out what the brief asks a map to show, then find the real thing.
 *
 * Two steps on purpose. The model only ever picks categories; every coordinate
 * that reaches the map comes from OpenStreetMap. Markers are added to the live
 * map, so they are inside the screenshot the image model is handed — which is
 * the difference between a poster with real medical posts on it and a poster
 * with plausible ones.
 */
export const syncOverlays = async () => {
  const state = appStore.getState()
  const lock = state.data.lock
  if (!lock) return

  const key = `${state.ai.prompt}|${lock.bbox.join(',')}`
  if (inFlight === key) return
  inFlight = key
  appStore.setState({ overlayStatus: 'planning' })

  const plan = await postJson<{ categories?: PlannedCategory[] }>('/api/plan-overlays', { prompt: state.ai.prompt })
  const categories = plan?.categories ?? []
  if (!categories.length) {
    appStore.setState({ overlays: [], overlayCategories: [], overlayStatus: 'idle' })
    return
  }

  appStore.setState({ overlayCategories: categories, overlayStatus: 'finding' })
  const found = await postJson<{ markers?: OverlayMarker[] }>('/api/osm-overlays', {
    bbox: lock.bbox,
    categories: categories.map((category) => category.key),
  })
  const markers = found?.markers ?? []

  // The viewport may have moved while we waited.
  if (appStore.getState().data.lock?.bbox.join(',') !== lock.bbox.join(',')) return
  appStore.setState({ overlays: markers, overlayStatus: 'ready' })
  if (markers.length) {
    addActivity('mark_from_osm', 'ok',
      `${markers.length} real ${categories.map((c) => c.label.toLowerCase()).join(' / ')} marked from OpenStreetMap`,
      { source: 'system' })
  }
}

export const clearOverlays = () => {
  inFlight = ''
  appStore.setState({ overlays: [], overlayCategories: [], overlayStatus: 'idle' })
}
