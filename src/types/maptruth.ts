import type { Feature, FeatureCollection, Geometry, LineString, Polygon } from 'geojson'

export type FeatureClass = 'road' | 'water' | 'park' | 'landmark'
export type PosterPreset = 'editorial' | 'retro' | 'blueprint'
export type PosterPalette = 'red-cream-black' | 'blue-white' | 'sunset'
export type LabelDensity = 'minimal' | 'balanced' | 'detailed'

export type SourceFeatureProperties = {
  id: string
  name?: string
  type: FeatureClass
  roadClass?: string
  osmType: 'node' | 'way' | 'relation'
  osmId: number
  geometryHash: string
}

export type SourceFeature = Feature<Geometry, SourceFeatureProperties>
export type SourceFeatureCollection = FeatureCollection<Geometry, SourceFeatureProperties>

export type FeatureRef = Pick<SourceFeatureProperties, 'id' | 'name' | 'type'>

export type PosterSpec = {
  title: string
  subtitle?: string
  preset: PosterPreset
  palette: PosterPalette
  emphasizedFeatureIds: string[]
  labelDensity: LabelDensity
  showLegend: boolean
}

export type HumanSelection =
  | { kind: 'route'; id: string; geometry: LineString; geometryHash: string }
  | { kind: 'area'; id: string; geometry: Polygon; geometryHash: string }

export type ActivityEntry = {
  id: string
  time: string
  tool: string
  status: 'ok' | 'error' | 'needs_user_action'
  summary: string
}

export type GeneratedComparison = {
  promptOnly: string
  screenshotGrounded: string
  mapTruthArtLayer: string
  model: 'openai/gpt-image-2'
}

export type ComparisonMode = 'poster' | 'source' | 'split' | 'overlay'

export type PlaceSource = 'none' | 'bundled' | 'overpass'

export type MapTruthState = {
  data: {
    status: 'idle' | 'loading' | 'ready' | 'error'
    features: SourceFeature[]
    error?: string
  }
  place: {
    name: string
    source: PlaceSource
  }
  map: {
    center: [number, number]
    zoom: number
    bbox: [number, number, number, number]
  }
  selection?: HumanSelection
  poster: {
    spec: PosterSpec
    status: 'empty' | 'rendering' | 'ready' | 'error'
    renderedFeatureIds: string[]
    warnings: string[]
  }
  ui: {
    comparisonMode: ComparisonMode
    seam: number
    webmcpAvailable: boolean
    webmcpStatus: 'checking' | 'available' | 'unavailable' | 'error'
    webmcpMessage?: string
  }
  ai: {
    status: 'idle' | 'generating' | 'ready' | 'error'
    prompt: string
    result?: GeneratedComparison
    error?: string
  }
  activity: ActivityEntry[]
}

export type RenderPosterInput = PosterSpec

export type ToolResult =
  | { status: 'ok'; [key: string]: unknown }
  | { status: 'ready'; [key: string]: unknown }
  | { status: 'verified'; [key: string]: unknown }
  | { status: 'needs_user_action'; reason: string; suggestedAction: string }
  | { status: 'error'; reason: string; details?: unknown }

