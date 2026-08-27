import { lookupWithinViewport } from './geocode'
import { resolveTruthPins } from './truthPins'
import { addActivity, appStore } from '../state/store'

let inFlight = ''

/**
 * Resolve the prompt's named things against OpenStreetMap and pin them.
 *
 * Runs after a lock and on prompt changes, debounced by the caller. Failures
 * are silent by design: a missing pin must never block generation, and an
 * unfound term simply means the brief did not name anything real here.
 */
export const syncTruthPins = async () => {
  const state = appStore.getState()
  if (!state.data.lock) return
  const bbox = state.data.lock.bbox
  const key = `${state.ai.prompt}|${bbox.join(',')}`
  if (inFlight === key) return
  inFlight = key

  const pins = await resolveTruthPins(
    state.ai.prompt,
    [state.place.name, state.place.label, state.place.query],
    bbox,
    lookupWithinViewport,
  )

  // The viewport may have moved on while we were waiting.
  if (appStore.getState().data.lock?.bbox.join(',') !== bbox.join(',')) return
  appStore.setState({ truthPins: pins })
  if (pins.length) {
    addActivity('find_in_osm', 'ok',
      `Found in OpenStreetMap: ${pins.map((pin) => pin.name).join(', ')}`, { source: 'system' })
  }
}

export const clearTruthPins = () => {
  inFlight = ''
  appStore.setState({ truthPins: [] })
}
