import type { Polygon } from 'geojson'

export const MAX_BBOX_SPAN_DEGREES = 0.09

export const bboxSpanOk = (bbox: [number, number, number, number]) => {
  const [west, south, east, north] = bbox
  return east - west <= MAX_BBOX_SPAN_DEGREES && north - south <= MAX_BBOX_SPAN_DEGREES
}

export const bboxToPolygon = (bbox: [number, number, number, number]): Polygon => {
  const [west, south, east, north] = bbox
  return {
    type: 'Polygon',
    coordinates: [[[west, south], [east, south], [east, north], [west, north], [west, south]]],
  }
}

export const formatPlaceLabel = (bbox: [number, number, number, number]) => {
  const centerLat = ((bbox[1] + bbox[3]) / 2).toFixed(3)
  const centerLon = ((bbox[0] + bbox[2]) / 2).toFixed(3)
  const latSuffix = Number(centerLat) >= 0 ? 'N' : 'S'
  const lonSuffix = Number(centerLon) >= 0 ? 'E' : 'W'
  return `Locked view · ${Math.abs(Number(centerLat)).toFixed(3)}°${latSuffix} ${Math.abs(Number(centerLon)).toFixed(3)}°${lonSuffix}`
}
