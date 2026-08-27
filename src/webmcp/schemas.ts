export const INSPECT_MAP_CONTEXT_SCHEMA = {
  type: 'object',
  properties: {
    detail: { type: 'string', enum: ['summary', 'features'] },
  },
  additionalProperties: false,
} as const

export const LOCK_LIVE_OSM_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

export const RENDER_POSTER_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', minLength: 1, maxLength: 80 },
    subtitle: { type: 'string', maxLength: 140 },
    preset: { type: 'string', enum: ['editorial', 'retro', 'blueprint'] },
    palette: { type: 'string', enum: ['red-cream-black', 'blue-white', 'sunset'] },
    emphasizedFeatureIds: {
      type: 'array',
      items: { type: 'string', maxLength: 64 },
      maxItems: 12,
      uniqueItems: true,
    },
    labelDensity: { type: 'string', enum: ['minimal', 'balanced', 'detailed'] },
    showLegend: { type: 'boolean' },
  },
  required: ['title', 'preset', 'palette', 'emphasizedFeatureIds', 'labelDensity', 'showLegend'],
  additionalProperties: false,
} as const

export const VERIFY_GEOGRAPHY_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

export const VERIFY_OSM_LOCK_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

export const INSPECT_COMPARISON_SCHEMA = {
  type: 'object',
  properties: {},
  additionalProperties: false,
} as const

export const NAVIGATE_MAP_SCHEMA = {
  type: 'object',
  properties: {
    center: {
      type: 'array',
      items: { type: 'number' },
      minItems: 2,
      maxItems: 2,
    },
    zoom: { type: 'number', minimum: 2, maximum: 18 },
    label: { type: 'string', maxLength: 60 },
  },
  required: ['center', 'zoom'],
  additionalProperties: false,
} as const

export const GENERATE_COMPARISON_SCHEMA = {
  type: 'object',
  properties: {
    prompt: { type: 'string', minLength: 1, maxLength: 1200 },
    routes: {
      type: 'array',
      items: { type: 'string', enum: ['promptOnly', 'screenshotGrounded', 'mapTruthGrounded'] },
      minItems: 1,
      maxItems: 3,
      uniqueItems: true,
    },
  },
  additionalProperties: false,
} as const

export const EXPORT_ARTWORK_SCHEMA = {
  type: 'object',
  properties: {
    format: { type: 'string', enum: ['png', 'svg'] },
  },
  required: ['format'],
  additionalProperties: false,
} as const

export const GET_MAP_CONTEXT_SCHEMA = INSPECT_MAP_CONTEXT_SCHEMA
export const LOCK_MAP_BOUNDARY_SCHEMA = LOCK_LIVE_OSM_SCHEMA
export const GET_DRAWN_GEOMETRY_SCHEMA = LOCK_LIVE_OSM_SCHEMA
