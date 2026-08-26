import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'

const rawPath = process.argv[2] ?? '.cache/osm/jakarta-raw.geojson'
const namedPath = process.argv[3] ?? '.cache/osm/jakarta-named.geojson'
const outputDirectory = process.argv[4] ?? 'public/data'

const BBOX = [106.785, -6.235, 106.855, -6.155]
const MAJOR_ROADS = new Set(['motorway', 'trunk', 'primary', 'secondary', 'tertiary'])
const LANDMARKS = new Map([
  ['a2318168514', 'Monumen Nasional'],
  ['a18246795', 'Museum Nasional Indonesia'],
  ['a19254473', 'Masjid Istiqlal'],
  ['a1365968306', 'Stadion Utama Gelora Bung Karno'],
  ['a735451178', 'Kompleks DPR/MPR RI'],
])

const stableStringify = (value) => JSON.stringify(value)
const sha256 = (value) => createHash('sha256').update(value).digest('hex')

const readGeojson = async (filePath) => JSON.parse(await readFile(filePath, 'utf8'))

const raw = await readGeojson(rawPath)
const named = await readGeojson(namedPath)
const sourceById = new Map([...raw.features, ...named.features].map((feature) => [feature.id, feature]))
const selected = new Map()

const addFeature = (feature, type, canonicalName) => {
  if (!feature?.geometry || feature.geometry.type === 'GeometryCollection') return
  const sourceId = String(feature.id)
  const osmType = feature.properties?.['@type']
  const osmId = feature.properties?.['@id']
  if (!sourceId || !osmType || typeof osmId !== 'number') return

  const id = `osm:${sourceId}`
  const geometryHash = sha256(stableStringify(feature.geometry))
  const roadClass = feature.properties?.highway
  selected.set(id, {
    type: 'Feature',
    id,
    geometry: feature.geometry,
    properties: {
      id,
      name: canonicalName ?? feature.properties?.name ?? undefined,
      type,
      roadClass: type === 'road' ? roadClass : undefined,
      osmType,
      osmId,
      geometryHash,
    },
  })
}

for (const feature of raw.features) {
  const properties = feature.properties ?? {}
  const geometryType = feature.geometry?.type

  if (properties.highway && ['LineString', 'MultiLineString'].includes(geometryType)) {
    if (MAJOR_ROADS.has(properties.highway) || properties.name) addFeature(feature, 'road')
    continue
  }

  if ((properties.natural === 'water' || properties.waterway) && geometryType !== 'Point') {
    addFeature(feature, 'water')
    continue
  }

  if (
    (properties.leisure === 'park' ||
      properties.leisure === 'garden' ||
      properties.landuse === 'recreation_ground' ||
      properties.landuse === 'grass') &&
    ['Polygon', 'MultiPolygon'].includes(geometryType)
  ) {
    addFeature(feature, 'park')
  }
}

for (const [sourceId, canonicalName] of LANDMARKS) {
  const feature = sourceById.get(sourceId)
  if (!feature) throw new Error(`Required landmark ${sourceId} (${canonicalName}) is missing`)
  addFeature(feature, 'landmark', canonicalName)
}

const order = { park: 0, water: 1, road: 2, landmark: 3 }
const features = [...selected.values()].sort((a, b) => {
  const typeOrder = order[a.properties.type] - order[b.properties.type]
  return typeOrder || a.properties.id.localeCompare(b.properties.id)
})

const featureCollection = {
  type: 'FeatureCollection',
  bbox: BBOX,
  features,
}
const featureIndex = features.map(({ properties }) => ({
  id: properties.id,
  name: properties.name,
  type: properties.type,
  osmRef: { type: properties.osmType, id: properties.osmId },
  geometryHash: properties.geometryHash,
}))

const featureCollectionJson = `${JSON.stringify(featureCollection)}\n`
const attribution = {
  place: 'Central Jakarta–Senayan',
  bbox: BBOX,
  source: {
    provider: 'Geofabrik GmbH',
    url: 'https://download.geofabrik.de/asia/indonesia/java-260825.osm.pbf',
    lastModified: '2026-08-25T23:24:29Z',
    sha256: 'd490da915938cdc8df6c0e13e067f63d4df1b58460313694563c4834f51b9dfb',
  },
  output: {
    sha256: sha256(featureCollectionJson),
    featureCount: features.length,
    generatedAt: '2026-08-26',
  },
  attribution: 'Map data © OpenStreetMap contributors',
  license: 'Open Data Commons Open Database License (ODbL) 1.0',
  licenseUrl: 'https://www.openstreetmap.org/copyright',
  processing: {
    bbox: BBOX,
    simplification: 'none',
    commands: 'scripts/prepare-osm.sh',
  },
}

await mkdir(outputDirectory, { recursive: true })
await Promise.all([
  writeFile(path.join(outputDirectory, 'demo-area.geojson'), featureCollectionJson),
  writeFile(path.join(outputDirectory, 'feature-index.json'), `${JSON.stringify(featureIndex, null, 2)}\n`),
  writeFile(path.join(outputDirectory, 'data-attribution.json'), `${JSON.stringify(attribution, null, 2)}\n`),
])

console.log(`Wrote ${features.length} source-backed features to ${outputDirectory}`)
