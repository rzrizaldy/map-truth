import { addActivity, appStore } from '../state/store'

let inFlight = ''

/**
 * Pin the subject of the map: the place that was chosen.
 *
 * It used to also scan the brief for capitalised words and pin whatever
 * OpenStreetMap returned for them, which put a pin labelled "Cafe" on a random
 * cafe two districts away from "Cafe terbaik di Bandung". The place is now
 * picked explicitly, so there is nothing left to guess — what the brief asks
 * the map to *show* is handled by marking, against a closed vocabulary.
 */
export const syncTruthPins = async () => {
  const state = appStore.getState()
  if (!state.data.lock) return
  const bbox = state.data.lock.bbox
  const key = `${state.place.label ?? state.place.name}|${bbox.join(',')}`
  if (inFlight === key) return
  inFlight = key

  const pins = state.place.source === 'geocoded' && state.place.center
    ? [{
        term: state.place.query ?? state.place.name,
        name: state.place.name,
        label: state.place.label ?? state.place.name,
        center: state.place.center,
      }]
    : []

  // The viewport may have moved on while we were waiting.
  if (appStore.getState().data.lock?.bbox.join(',') !== bbox.join(',')) return
  appStore.setState({ truthPins: pins })
  if (pins.length) {
    addActivity('find_in_osm', 'ok', `Subject pinned from OpenStreetMap: ${pins[0].name}`, { source: 'system' })
  }
}

export const clearTruthPins = () => {
  inFlight = ''
  appStore.setState({ truthPins: [] })
}
