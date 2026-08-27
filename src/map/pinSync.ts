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

  const found = await resolveTruthPins(
    state.ai.prompt,
    [state.place.name, state.place.label, state.place.query],
    bbox,
    lookupWithinViewport,
  )

  // A place reached by name is the subject of the brief, so mark it even though
  // it is also the map's centre — otherwise asking for the DPR building centres
  // on it and then leaves it unlabelled.
  const focused = state.place.source === 'geocoded' && state.place.center
    ? [{
        term: state.place.query ?? state.place.name,
        name: state.place.name,
        label: state.place.label ?? state.place.name,
        center: state.place.center,
      }]
    : []
  const seen = new Set(focused.map((pin) => pin.name.toLowerCase()))
  const pins = [...focused, ...found.filter((pin) => !seen.has(pin.name.toLowerCase()))]

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
