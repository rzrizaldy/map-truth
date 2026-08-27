import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { ActivityEntry, MapTruthState } from '../types/maptruth'
import { NYC_CENTER, NYC_ZOOM } from '../map/constants'

export const DEFAULT_POSTER_SPEC = {
  title: 'Map without invention',
  subtitle: 'A source-backed public-information map',
  preset: 'editorial' as const,
  palette: 'red-cream-black' as const,
  emphasizedFeatureIds: [] as string[],
  labelDensity: 'balanced' as const,
  showLegend: true,
}

const emptyRoutes = () => ({
  promptOnly: { status: 'idle' as const },
  screenshotGrounded: { status: 'idle' as const },
  mapTruthGrounded: { status: 'idle' as const },
})

const baseState = (): MapTruthState => ({
  data: { status: 'idle', features: [], verificationStatus: 'idle' },
  place: { name: 'Manhattan, New York', source: 'none' },
  map: {
    center: NYC_CENTER,
    zoom: NYC_ZOOM,
    bbox: [-74.02, 40.72, -73.95, 40.78],
  },
  poster: {
    spec: DEFAULT_POSTER_SPEC,
    status: 'empty',
    renderedFeatureIds: [],
    warnings: [],
  },
  ui: {
    comparisonMode: 'split',
    seam: 52,
    webmcpAvailable: false,
    webmcpStatus: 'checking',
    mapReady: false,
    canUndo: false,
  },
  ai: {
    prompt:
      'Create a bold editorial map poster in black, cream, and dispatch red. Emphasize major roads and civic landmarks. Keep labels minimal.',
    routes: emptyRoutes(),
  },
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
