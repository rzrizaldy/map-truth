import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { ActivityEntry, MapTruthState } from '../types/maptruth'
import { NYC_CENTER, NYC_ZOOM } from '../map/constants'
import { EXAMPLES } from '../map/examples'

const emptyRoutes = () => ({
  promptOnly: { status: 'idle' as const },
  screenshotGrounded: { status: 'idle' as const },
})

const baseState = (): MapTruthState => ({
  data: { status: 'idle', features: [], verificationStatus: 'idle' },
  place: { name: 'Manhattan, New York', source: 'none' },
  map: {
    center: NYC_CENTER,
    zoom: NYC_ZOOM,
    bbox: [-74.02, 40.72, -73.95, 40.78],
  },
  ui: {
    webmcpAvailable: false,
    webmcpStatus: 'checking',
    mapReady: false,
    canUndo: false,
  },
  ai: {
    // Starts on the first example so the picker shows a consistent state.
    prompt: EXAMPLES[0].prompt,
    routes: emptyRoutes(),
  },
  truthPins: [],
  overlayCategories: [],
  overlays: [],
  overlayStatus: 'idle',
  namedPlaces: [],
  namedPlacesAsked: 0,
  namedPlacesStatus: 'idle',
  activity: [],
})

export const appStore = createStore<MapTruthState>(baseState)

export const resetStudioState = () => {
  appStore.setState(baseState())
}

export const useAppStore = <T>(selector: (state: MapTruthState) => T): T =>
  useStore(appStore, selector)

export const addActivity = (
  tool: string,
  status: 'ok' | 'error' | 'needs_user_action',
  summary: string,
  details: Partial<Omit<ActivityEntry, 'id' | 'time' | 'tool' | 'status' | 'summary'>> = {},
) => {
  const entry = {
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tool,
    status,
    summary,
    source: 'system' as const,
    ...details,
  }
  appStore.setState((state) => ({ activity: [entry, ...state.activity].slice(0, 14) }))
  return entry.id
}
