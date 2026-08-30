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

export type Plan = { categories: PlannedCategory[]; places: string[]; failed?: boolean }

/**
 * Ask what a brief needs: kinds of place, and the specific ones worth naming.
 *
 * The place the map is on is part of the question — "the best cafes" has no
 * answer without it.
 */
export const planOverlays = async (prompt: string, place?: string): Promise<Plan> => {
  const payload = await postJson<{ categories?: PlannedCategory[]; places?: string[]; error?: string }>(
    '/api/plan-overlays', { prompt, place },
  )
  // "Could not work it out" and "nothing to mark" are different answers.
  if (!payload || payload.error) return { categories: [], places: [], failed: true }
  return { categories: payload.categories ?? [], places: payload.places ?? [] }
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
export const syncOverlays = async (planned?: PlannedCategory[]) => {
  const state = appStore.getState()
  const lock = state.data.lock
  if (!lock) return

  // The plan is part of the identity of a run. Keying on brief and viewport
  // alone meant a first pass that ran before the plan arrived — and so marked
  // nothing — blocked the real pass that followed it.
  const key = `${state.ai.prompt}|${lock.bbox.join(',')}|${(planned ?? []).map((c) => c.key).join('+')}`
  if (inFlight === key) return
  inFlight = key
  appStore.setState({ overlayStatus: 'planning' })

  // The read-back already planned this brief. Re-planning here would spend a
  // second model call, and latency, to learn the same thing.
  const categories = planned?.length
    ? planned
    : (await postJson<{ categories?: PlannedCategory[] }>('/api/plan-overlays', { prompt: state.ai.prompt }))?.categories ?? []
  if (!categories.length) {
    inFlight = ''
    appStore.setState({ overlays: [], overlayCategories: [], overlayStatus: 'idle' })
    return
  }

  appStore.setState({ overlayCategories: categories, overlayStatus: 'finding' })
  const found = await postJson<{ markers?: OverlayMarker[]; error?: string }>('/api/osm-overlays', {
    bbox: lock.bbox,
    categories: categories.map((category) => category.key),
  })

  // The viewport may have moved while we waited.
  if (appStore.getState().data.lock?.bbox.join(',') !== lock.bbox.join(',')) return

  // "OpenStreetMap was unreachable" and "there is nothing here" are different
  // answers, and showing both as a count of zero is a quiet lie.
  if (!found || found.error) {
    inFlight = ''
    appStore.setState({ overlays: [], overlayStatus: 'error' })
    addActivity('mark_from_osm', 'error', 'Could not reach OpenStreetMap to mark the map', { source: 'system' })
    return
  }

  const markers = found.markers ?? []
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
