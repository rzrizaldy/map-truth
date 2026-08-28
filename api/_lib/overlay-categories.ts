/**
 * What a map can be asked to show, and how to find real instances of it.
 *
 * The model is only ever allowed to choose from these keys. It reasons about
 * what the brief needs; OpenStreetMap decides where those things actually are.
 * Letting a model emit raw Overpass would put invented geography back in.
 */
export const OVERLAY_CATEGORIES = {
  gathering_point: {
    label: 'Gathering point',
    colour: '#1a73e8',
    describe: 'open space where a crowd can assemble — parks, squares, plazas',
    filters: ['["leisure"="park"]', '["leisure"="common"]', '["place"="square"]', '["leisure"="pitch"]'],
  },
  medical: {
    label: 'Medical',
    colour: '#ea4335',
    describe: 'hospitals, clinics, doctors, pharmacies',
    filters: ['["amenity"="hospital"]', '["amenity"="clinic"]', '["amenity"="doctors"]', '["amenity"="pharmacy"]'],
  },
  shelter: {
    label: 'Shelter',
    colour: '#9334e6',
    describe: 'shelters and designated assembly points',
    filters: ['["amenity"="shelter"]', '["emergency"="assembly_point"]'],
  },
  police: {
    label: 'Police',
    colour: '#1967d2',
    describe: 'police stations and posts',
    filters: ['["amenity"="police"]'],
  },
  transit: {
    label: 'Transit',
    colour: '#188038',
    describe: 'stations, bus stations and stops for arriving or leaving',
    filters: ['["railway"="station"]', '["amenity"="bus_station"]', '["public_transport"="station"]'],
  },
  water: {
    label: 'Water',
    colour: '#12b5cb',
    describe: 'drinking water and toilets',
    filters: ['["amenity"="drinking_water"]', '["amenity"="toilets"]'],
  },
  food: {
    label: 'Food',
    colour: '#e37400',
    describe: 'places to eat or buy supplies',
    filters: ['["amenity"="restaurant"]', '["amenity"="cafe"]', '["shop"="supermarket"]'],
  },
  worship: {
    label: 'Place of worship',
    colour: '#a8a116',
    describe: 'mosques, churches, temples',
    filters: ['["amenity"="place_of_worship"]'],
  },
  education: {
    label: 'School',
    colour: '#b06000',
    describe: 'schools and universities',
    filters: ['["amenity"="school"]', '["amenity"="university"]'],
  },
  fuel: {
    label: 'Fuel',
    colour: '#5f6368',
    describe: 'petrol stations',
    filters: ['["amenity"="fuel"]'],
  },
} as const

export type OverlayCategory = keyof typeof OVERLAY_CATEGORIES

export const isOverlayCategory = (value: unknown): value is OverlayCategory =>
  typeof value === 'string' && Object.hasOwn(OVERLAY_CATEGORIES, value)

export const categoryMenu = () =>
  (Object.entries(OVERLAY_CATEGORIES) as Array<[OverlayCategory, { describe: string }]>)
    .map(([key, value]) => `${key}: ${value.describe}`)
    .join('\n')
