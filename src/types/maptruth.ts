import type { Feature, FeatureCollection, Geometry, Polygon } from 'geojson'
import type { TruthPin } from '../map/truthPins'

export type FeatureClass = 'road' | 'water' | 'park' | 'landmark'
export type FeatureSourceKind = 'viewport_tile' | 'openstreetmap'
export type PosterPreset = 'editorial' | 'retro' | 'blueprint'
export type PosterPalette = 'red-cream-black' | 'blue-white' | 'sunset'
export type LabelDensity = 'minimal' | 'balanced' | 'detailed'

export type SourceFeatureProperties = {
  id: string
  name?: string
  type: FeatureClass
  roadClass?: string
  sourceKind: FeatureSourceKind
  osmType?: 'node' | 'way' | 'relation'
  osmId?: number
  sourceId?: string
  sourceLayer?: string
  tileFeatureId?: string
  sourceRevision?: string
  rank?: number
  geometryHash: string
}

export type SourceFeature = Feature<Geometry, SourceFeatureProperties>
export type SourceFeatureCollection = FeatureCollection<Geometry, SourceFeatureProperties>

export type FeatureRef = Pick<SourceFeatureProperties, 'id' | 'name' | 'type'>

export type PosterSpec = {
  preset: PosterPreset
  palette: PosterPalette
  emphasizedFeatureIds: string[]
  labelDensity: LabelDensity
  showLegend: boolean
}

// The locked viewport is the only selection MapTruth makes.
export type HumanSelection = { kind: 'area'; id: string; geometry: Polygon; geometryHash: string }

export type ActivityEntry = {
  id: string
  time: string
  tool: string
  status: 'ok' | 'error' | 'needs_user_action'
  summary: string
  durationMs?: number
  affectedFeatureIds?: string[]
  beforeHash?: string
  afterHash?: string
  source?: 'manual' | 'webmcp' | 'system'
  reversible?: boolean
}

export type ComparisonRoute = 'promptOnly' | 'screenshotGrounded' | 'mapTruthGrounded'
export type GenerationStatus = 'idle' | 'awaiting_approval' | 'queued' | 'generating' | 'ready' | 'error' | 'cancelled'

export type GenerationRouteState = {
  status: GenerationStatus
  imageDataUrl?: string
  error?: string
  startedAt?: number
  durationMs?: number
}

export type GeographyLock = {
  id: string
  kind: 'live' | 'verified'
  bbox: [number, number, number, number]
  zoom: number
  sourceRevision: string
  geometryHash: string
  createdAt: string
  featureCount: number
}

export type ComparisonMode = 'poster' | 'source' | 'split' | 'overlay'

export type PlaceSource = 'none' | 'live' | 'overpass' | 'geocoded'

export type MapTruthState = {
  data: {
    status: 'idle' | 'loading' | 'ready' | 'error'
    features: SourceFeature[]
    lock?: GeographyLock
    verificationStatus: 'idle' | 'verifying' | 'verified' | 'error'
    verificationError?: string
    error?: string
  }
  place: {
    name: string
    source: PlaceSource
    /** Full geocoder label for the locked viewport, when one resolved. */
    label?: string
    /** What the caller actually asked for, when the place was reached by name. */
    query?: string
    resolving?: boolean
  }
  map: {
    center: [number, number]
    zoom: number
    bbox: [number, number, number, number]
  }
  selection?: HumanSelection
  /** Real OSM coordinates for things the prompt named, inside the lock. */
  truthPins: TruthPin[]
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
    mapReady: boolean
    selectedReceiptId?: string
    canUndo: boolean
  }
  ai: {
    prompt: string
    routes: Record<ComparisonRoute, GenerationRouteState>
    pendingRoutes?: ComparisonRoute[]
  }
  activity: ActivityEntry[]
}

export type RenderPosterInput = PosterSpec

export type ToolResult =
  | { status: 'ok'; [key: string]: unknown }
  | { status: 'ready'; [key: string]: unknown }
  | { status: 'verified'; [key: string]: unknown }
  | { status: 'needs_user_action'; reason: string; suggestedAction: string; [key: string]: unknown }
  | { status: 'error'; reason: string; details?: unknown }
