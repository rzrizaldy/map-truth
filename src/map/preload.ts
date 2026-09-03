import snapshot from './preload.data.json'
import { addActivity, appStore } from '../state/store'
import type { NamedPlace } from './namedPlaces'
import type { OverlayMarker, PlannedCategory } from './overlays'
import type { GeocodedPlace } from './placeTypes'

export type PreloadedScenario = {
  place: GeocodedPlace
  categories: PlannedCategory[]
  suggested: string[]
  markers: OverlayMarker[]
  named: NamedPlace[]
}

const scenarios = snapshot.scenarios as unknown as Record<string, PreloadedScenario>

/** The day the snapshot was taken from the live pipeline. */
export const CAPTURED_AT = snapshot.capturedAt

export const preloadFor = (label: string): PreloadedScenario | undefined => scenarios[label]

/**
 * Replay a scenario that was already answered, instead of asking again.
 *
 * Every value here came out of the real pipeline and is checked in by
 * `npm run capture:preload`: the geocoder found the place, the model chose the
 * categories, OpenStreetMap supplied every coordinate. What is skipped is the
 * asking, not the grounding — which matters because the asking is the part
 * that fails. The model plan has been measured at fourteen seconds on a good
 * run and timing out on a bad one, and a public Overpass mirror sheds load
 * without warning; a demo should not be a bet on three services being awake at
 * the moment somebody presses record.
 *
 * It applies only to the shipped examples. Anything typed into the box goes
 * out to the live services as before, which is the honest default — so the
 * button that says "example" is the one that is fast, and the box that invites
 * a stranger's own city is the one that really asks.
 */
export const applyPreloadedScenario = (scenario: PreloadedScenario) => {
  appStore.setState({
    overlayCategories: scenario.categories,
    overlays: scenario.markers,
    overlayStatus: 'ready',
    namedPlaces: scenario.named,
    namedPlacesAsked: scenario.suggested.length,
    namedPlacesStatus: scenario.suggested.length ? 'ready' : 'idle',
  })
  addActivity('mark_from_osm', 'ok',
    `${scenario.markers.length} real ${scenario.categories.map((category) => category.label.toLowerCase()).join(' / ')}`
    + ` from a saved OpenStreetMap snapshot (${CAPTURED_AT})`,
    { source: 'system' })
}
