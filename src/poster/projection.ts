import type { Geometry, Position } from 'geojson'

export type PosterFrame = {
  width: number
  height: number
  padding: number
  bounds: [number, number, number, number]
}

const mercator = ([longitude, latitude]: Position): [number, number] => {
  const x = (longitude + 180) / 360
  const latitudeRadians = (Math.max(-85, Math.min(85, latitude)) * Math.PI) / 180
  const y = (1 - Math.log(Math.tan(latitudeRadians) + 1 / Math.cos(latitudeRadians)) / Math.PI) / 2
  return [x, y]
}

/**
 * Project a coordinate into the poster frame.
 *
 * Scaling x and y independently to fill the frame is what makes a map "look
 * accurate but feel wrong": a wide viewport squeezed into a tall poster
 * silently stretches every street and every distance. Mercator only preserves
 * shape under a single uniform scale, so take the tighter of the two axes and
 * centre the leftover space.
 */
export const projectPosition = (position: Position, frame: PosterFrame): [number, number] => {
  const [west, south, east, north] = frame.bounds
  const [minX, maxY] = mercator([west, south])
  const [maxX, minY] = mercator([east, north])
  const [x, y] = mercator(position)

  const spanX = Math.max(maxX - minX, Number.EPSILON)
  const spanY = Math.max(maxY - minY, Number.EPSILON)
  const drawableWidth = frame.width - frame.padding * 2
  const drawableHeight = frame.height - frame.padding * 2
  const scale = Math.min(drawableWidth / spanX, drawableHeight / spanY)

  const offsetX = frame.padding + (drawableWidth - spanX * scale) / 2
  const offsetY = frame.padding + (drawableHeight - spanY * scale) / 2
  return [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale]
}

const linePath = (coordinates: Position[], frame: PosterFrame, close = false): string => {
  const path = coordinates
    .map((coordinate, index) => {
      const [x, y] = projectPosition(coordinate, frame)
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
  return close ? `${path} Z` : path
}

export const geometryToPath = (geometry: Geometry, frame: PosterFrame): string => {
  switch (geometry.type) {
    case 'Point': {
      const [x, y] = projectPosition(geometry.coordinates, frame)
      return `M${x.toFixed(2)},${y.toFixed(2)} m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0`
    }
    case 'MultiPoint':
      return geometry.coordinates
        .map((coordinate) => geometryToPath({ type: 'Point', coordinates: coordinate }, frame))
        .join(' ')
    case 'LineString':
      return linePath(geometry.coordinates, frame)
    case 'MultiLineString':
      return geometry.coordinates.map((line) => linePath(line, frame)).join(' ')
    case 'Polygon':
      return geometry.coordinates.map((ring) => linePath(ring, frame, true)).join(' ')
    case 'MultiPolygon':
      return geometry.coordinates
        .flatMap((polygon) => polygon.map((ring) => linePath(ring, frame, true)))
        .join(' ')
    default:
      return ''
  }
}

const flattenPositions = (geometry: Geometry): Position[] => {
  if (geometry.type === 'Point') return [geometry.coordinates]
  if (geometry.type === 'MultiPoint' || geometry.type === 'LineString') return geometry.coordinates
  if (geometry.type === 'MultiLineString' || geometry.type === 'Polygon') return geometry.coordinates.flat()
  if (geometry.type === 'MultiPolygon') return geometry.coordinates.flat(2)
  return []
}

export const geometryAnchor = (geometry: Geometry, frame: PosterFrame): [number, number] => {
  const positions = flattenPositions(geometry)
  if (!positions.length) return [frame.width / 2, frame.height / 2]
  const center = positions.reduce(
    (sum, position) => [sum[0] + position[0], sum[1] + position[1]],
    [0, 0],
  )
  return projectPosition([center[0] / positions.length, center[1] / positions.length], frame)
}

