import { lookupAllWithinViewport } from './geocode'
import { addActivity, appStore } from '../state/store'

export type NamedPlace = { name: string; label: string; center: [number, number] }

let inFlight = ''

/**
 * Ground the places the model named against OpenStreetMap.
 *
 * The model knows which cafes in Bandung people actually mean; OpenStreetMap
 * knows where they are. So the model only ever proposes names — every
 * coordinate comes from the lookup, and a suggestion that cannot be found in
 * the locked view is dropped rather than placed approximately. The count of
 * what was dropped is kept, because "five of the seven it named exist here" is
 * the honest result.
 */
export const resolveNamedPlaces = async (names: string[]) => {
  const state = appStore.getState()
  const lock = state.data.lock
  if (!lock) return

  const key = `${lock.bbox.join(',')}|${names.join('|')}`
  if (inFlight === key) return
  inFlight = key

  if (!names.length) {
    appStore.setState({ namedPlaces: [], namedPlacesAsked: 0, namedPlacesStatus: 'idle' })
    return
  }

  appStore.setState({ namedPlacesAsked: names.length, namedPlacesStatus: 'finding' })
  const found = (await lookupAllWithinViewport(names, lock.bbox))
    .map(({ query, place }) => (place ? { name: query, label: place.label, center: place.center } : null))

  // The viewport may have moved on while we waited.
  if (appStore.getState().data.lock?.bbox.join(',') !== lock.bbox.join(',')) return

  const verified = found.filter((place): place is NamedPlace => place !== null)
  appStore.setState({ namedPlaces: verified, namedPlacesStatus: 'ready' })
  addActivity('ground_named_places', verified.length ? 'ok' : 'needs_user_action',
    `${verified.length} of ${names.length} suggested places found in OpenStreetMap`,
    { source: 'system' })
}

export const clearNamedPlaces = () => {
  inFlight = ''
  appStore.setState({ namedPlaces: [], namedPlacesAsked: 0, namedPlacesStatus: 'idle' })
}
