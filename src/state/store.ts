import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { MapTruthState } from '../types/maptruth'

export const DEFAULT_POSTER_SPEC = {
  title: 'Jakarta, without invention',
  subtitle: 'A source-backed public-information map',
  preset: 'editorial' as const,
  palette: 'red-cream-black' as const,
  emphasizedFeatureIds: ['osm:a2318168514', 'osm:a735451178'],
  labelDensity: 'balanced' as const,
  showLegend: true,
}

export const appStore = createStore<MapTruthState>(() => ({
  data: { status: 'idle', features: [] },
  map: {
    center: [106.82, -6.195],
    zoom: 12.7,
    bbox: [106.785, -6.235, 106.855, -6.155],
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
  },
  ai: {
    status: 'idle',
    prompt:
      'Create a bold Jakarta public-information poster in black, cream, and dispatch red. Emphasize the route and key civic landmarks. Keep labels minimal.',
  },
  activity: [],
}))

export const useAppStore = <T>(selector: (state: MapTruthState) => T): T =>
  useStore(appStore, selector)

export const addActivity = (
  tool: string,
  status: 'ok' | 'error' | 'needs_user_action',
  summary: string,
) => {
  const entry = {
    id: crypto.randomUUID(),
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    tool,
    status,
    summary,
  }
  appStore.setState((state) => ({ activity: [entry, ...state.activity].slice(0, 8) }))
}

