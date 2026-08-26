import { useStore } from 'zustand'
import { createStore } from 'zustand/vanilla'
import type { MapTruthState } from '../types/maptruth'
import { JAKARTA_BBOX, JAKARTA_CENTER, JAKARTA_ZOOM, NYC_CENTER, NYC_ZOOM } from '../map/constants'

export const DEFAULT_POSTER_SPEC = {
  title: 'Map without invention',
  subtitle: 'A source-backed public-information map',
  preset: 'editorial' as const,
  palette: 'red-cream-black' as const,
  emphasizedFeatureIds: [] as string[],
  labelDensity: 'balanced' as const,
  showLegend: true,
}

export const JAKARTA_POSTER_SPEC = {
  ...DEFAULT_POSTER_SPEC,
  title: 'Jakarta, without invention',
  emphasizedFeatureIds: ['osm:a2318168514', 'osm:a735451178'],
}

const baseState = (): MapTruthState => ({
  data: { status: 'idle', features: [] },
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
  },
  ai: {
    status: 'idle',
    prompt:
      'Create a bold editorial map poster in black, cream, and dispatch red. Emphasize major roads and civic landmarks. Keep labels minimal.',
  },
  activity: [],
})

export const appStore = createStore<MapTruthState>(baseState)

export const resetDemoState = () => appStore.setState(baseState())

export const resetAboutState = () =>
  appStore.setState({
    ...baseState(),
    place: { name: 'Central Jakarta–Senayan', source: 'bundled' },
    map: { center: JAKARTA_CENTER, zoom: JAKARTA_ZOOM, bbox: JAKARTA_BBOX },
    poster: { spec: JAKARTA_POSTER_SPEC, status: 'empty', renderedFeatureIds: [], warnings: [] },
    ai: {
      status: 'idle',
      prompt:
        'Create a bold Jakarta public-information poster in black, cream, and dispatch red. Emphasize the route and key civic landmarks. Keep labels minimal.',
    },
  })

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
