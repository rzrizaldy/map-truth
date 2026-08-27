export type GeocodedPlace = {
  name: string
  label: string
  center: [number, number]
  bbox: [number, number, number, number]
  zoom: number
  kind: string
}
