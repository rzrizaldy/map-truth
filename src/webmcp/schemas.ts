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
      items: { type: 'string', enum: ['promptOnly', 'screenshotGrounded'] },
      minItems: 1,
      maxItems: 2,
      uniqueItems: true,
    },
  },
  additionalProperties: false,
} as const

export const FOCUS_PLACE_SCHEMA = {
  type: 'object',
  properties: {
    place: { type: 'string', minLength: 1, maxLength: 120 },
    lock: { type: 'boolean' },
  },
  required: ['place'],
  additionalProperties: false,
} as const

export const EXPORT_ARTWORK_SCHEMA = {
  type: 'object',
  properties: {
    route: { type: 'string', enum: ['promptOnly', 'screenshotGrounded'] },
  },
  additionalProperties: false,
} as const
