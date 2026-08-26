import bbox from '@turf/bbox'
import booleanIntersects from '@turf/boolean-intersects'
import buffer from '@turf/buffer'
import type { Feature, Geometry, LineString, Polygon } from 'geojson'
import type { HumanSelection, MapTruthState, SourceFeature } from '../types/maptruth'

const rectangle = ([west, south, east, north]: [number, number, number, number]): Feature<Polygon> => ({
  type: 'Feature',
  properties: {},
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  },
})

export const selectionPolygon = (selection?: HumanSelection): Feature<Polygon> | undefined => {
  if (!selection) return undefined
  if (selection.kind === 'area') {
    return { type: 'Feature', properties: {}, geometry: selection.geometry }
  }
  return buffer(
    { type: 'Feature', properties: {}, geometry: selection.geometry as LineString },
    0.35,
    { units: 'kilometers' },
  ) as Feature<Polygon> | undefined
}

export const currentContextGeometry = (state: MapTruthState): Feature<Polygon> =>
  selectionPolygon(state.selection) ?? rectangle(state.map.bbox)

export const featuresInContext = (state: MapTruthState): SourceFeature[] => {
  const context = currentContextGeometry(state)
  return state.data.features.filter((feature) => {
    try {
      return booleanIntersects(feature as Feature<Geometry>, context)
    } catch {
      return false
    }
  })
}

export const contextBounds = (state: MapTruthState): [number, number, number, number] => {
  const bounds = bbox(currentContextGeometry(state))
  return [bounds[0], bounds[1], bounds[2], bounds[3]]
}

export const demoRoute: LineString = {
  type: 'LineString',
  coordinates: [
    [106.8004, -6.2107],
    [106.8068, -6.2025],
    [106.8148, -6.1948],
    [106.8208, -6.1852],
    [106.8271, -6.1754],
  ],
}

