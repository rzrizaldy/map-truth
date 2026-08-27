import bbox from '@turf/bbox'
import booleanIntersects from '@turf/boolean-intersects'
import type { Feature, Geometry, Polygon } from 'geojson'
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

export const selectionPolygon = (selection?: HumanSelection): Feature<Polygon> | undefined =>
  selection ? { type: 'Feature', properties: {}, geometry: selection.geometry } : undefined

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
