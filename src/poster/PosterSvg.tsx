import type { SourceFeature } from '../types/maptruth'
import { contextBounds, featuresInContext } from '../map/context'
import { geometryAnchor, geometryToPath, type PosterFrame } from './projection'
import { useAppStore } from '../state/store'
import { posterTitleFromPrompt } from './title'
import barlowData from '@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff2?inline'
import sourceSansData from '@fontsource/source-sans-3/files/source-sans-3-latin-400-normal.woff2?inline'
import plexData from '@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2?inline'

type PosterSvgProps = {
  id?: string
  sourceMode?: boolean
  backgroundImage?: string
  className?: string
}

const colors = {
  'red-cream-black': { paper: '#F8F9FA', ink: '#202124', accent: '#1A73E8', water: '#AADAFF', park: '#CDEAC4' },
  'blue-white': { paper: '#F7FAFB', ink: '#12324A', accent: '#1877A2', water: '#4B99B5', park: '#B9D6CE' },
  sunset: { paper: '#F4D7B7', ink: '#2B1A1A', accent: '#D85D3B', water: '#6E7897', park: '#B8A873' },
} as const

const layerOrder: Record<string, number> = { park: 0, water: 1, road: 2, landmark: 3 }

const featureStyle = (
  feature: SourceFeature,
  palette: (typeof colors)[keyof typeof colors],
  emphasized: boolean,
  sourceMode: boolean,
) => {
  if (sourceMode) {
    if (feature.properties.type === 'park') return { fill: '#e6efe3', stroke: 'none', strokeWidth: 0 }
    if (feature.properties.type === 'water') return { fill: '#dceeff', stroke: '#dceeff', strokeWidth: 2.5 }
    if (feature.properties.type === 'landmark') return { fill: '#5f6368', stroke: '#ffffff', strokeWidth: 1.5 }
    const sourceRank = feature.properties.rank ?? 7
    if (emphasized) return { fill: 'none', stroke: '#202124', strokeWidth: 4 }
    if (sourceRank <= 3) return { fill: 'none', stroke: '#80868b', strokeWidth: 2 }
    return { fill: 'none', stroke: '#bdc1c6', strokeWidth: 1 }
  }
  if (feature.properties.type === 'park') return { fill: palette.park, stroke: 'none', strokeWidth: 0 }
  if (feature.properties.type === 'water') return { fill: palette.water, stroke: palette.water, strokeWidth: emphasized ? 6 : 3 }
  if (feature.properties.type === 'landmark') return { fill: emphasized ? palette.accent : palette.ink, stroke: palette.paper, strokeWidth: 2 }
  // Weight roads by importance so 4,000 paths still read as a street network
  // instead of one solid black scribble.
  const rank = feature.properties.rank ?? 7
  if (emphasized) return { fill: 'none', stroke: palette.accent, strokeWidth: 6 }
  if (rank <= 1) return { fill: 'none', stroke: palette.ink, strokeWidth: 3.4 }
  if (rank <= 3) return { fill: 'none', stroke: palette.ink, strokeWidth: 2.2 }
  if (rank <= 5) return { fill: 'none', stroke: '#5f6368', strokeWidth: 1.4 }
  return { fill: 'none', stroke: '#9aa0a6', strokeWidth: 0.9 }
}

const shouldLabel = (feature: SourceFeature, density: string, index: number, emphasized: boolean) => {
  if (!feature.properties.name) return false
  if (emphasized || feature.properties.type === 'landmark') return true
  if (density === 'minimal') return false
  if (density === 'balanced') return index % 18 === 0
  return index % 8 === 0
}

const legendLayers = () => [
  { key: 'road', label: 'Roads' },
  { key: 'water', label: 'Water' },
  { key: 'park', label: 'Parks' },
  { key: 'landmark', label: 'Landmarks' },
] as const

export function PosterSvg({ id, sourceMode = false, backgroundImage, className }: PosterSvgProps) {
  const state = useAppStore((value) => value)
  const { spec } = state.poster
  const palette = colors[spec.palette]
  const bounds = contextBounds(state)
  const frame: PosterFrame = { width: 1200, height: 1050, padding: 60, bounds }
  const features = featuresInContext(state).sort(
    (a, b) => layerOrder[a.properties.type] - layerOrder[b.properties.type],
  )
  const emphasized = new Set(spec.emphasizedFeatureIds)
  const mapTransform = 'translate(0 300)'
  const posterTitle = posterTitleFromPrompt(state.ai.prompt, state.place.name)

  return (
    <svg
      id={id}
      className={className}
      viewBox="0 0 1200 1500"
      role="img"
      aria-label={sourceMode ? 'Neutral source map' : `${posterTitle} grounded poster`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <style>{`
        @font-face{font-family:BarlowEmbedded;src:url(${barlowData}) format('woff2');font-weight:700}
        @font-face{font-family:SourceEmbedded;src:url(${sourceSansData}) format('woff2');font-weight:400}
        @font-face{font-family:PlexEmbedded;src:url(${plexData}) format('woff2');font-weight:500}
        .poster-title{font-family:BarlowEmbedded,Arial Narrow,sans-serif;font-weight:700}
        .poster-copy{font-family:SourceEmbedded,Arial,sans-serif}
        .poster-mono{font-family:PlexEmbedded,monospace;font-weight:500}
      `}</style>
      <defs>
        <clipPath id={`map-clip-${id ?? 'preview'}`}><rect x="0" y="300" width="1200" height="1050" /></clipPath>
        <pattern id={`grid-${id ?? 'preview'}`} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke={palette.ink} strokeOpacity="0.08" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1200" height="1500" fill={sourceMode ? '#f1f3f4' : palette.paper} />
      {backgroundImage && !sourceMode ? (
        <>
          <image href={backgroundImage} width="1200" height="1500" preserveAspectRatio="xMidYMid slice" opacity="0.55" />
          {/* Keep the generated art readable underneath: the locked vectors are
              the point of route 3, so they must never fight the art layer. */}
          <rect width="1200" height="1500" fill={palette.paper} opacity="0.34" />
        </>
      ) : null}
      {spec.preset === 'blueprint' && !sourceMode ? <rect width="1200" height="1500" fill={`url(#grid-${id ?? 'preview'})`} /> : null}

      <g transform={mapTransform} clipPath={`url(#map-clip-${id ?? 'preview'})`}>
        {features.map((feature) => {
          const isEmphasized = emphasized.has(feature.properties.id)
          const style = featureStyle(feature, palette, isEmphasized, sourceMode)
          return (
            <path
              key={feature.properties.id}
              d={geometryToPath(feature.geometry, frame)}
              fill={style.fill}
              fillRule="evenodd"
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              strokeLinejoin="round"
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
              opacity={1}
              data-source-id={feature.properties.id}
              data-geometry-hash={feature.properties.geometryHash}
              data-feature-class={feature.properties.type}
            />
          )
        })}
        {features.map((feature, index) => {
          const isEmphasized = emphasized.has(feature.properties.id)
          if (!shouldLabel(feature, spec.labelDensity, index, isEmphasized)) return null
          const [x, y] = geometryAnchor(feature.geometry, frame)
          return (
            <text
              key={`label-${feature.properties.id}`}
              x={x}
              y={y - 10}
              className="poster-mono"
              textAnchor="middle"
              fontSize={isEmphasized ? 22 : 14}
              letterSpacing="0.04em"
              fill={sourceMode ? '#202124' : palette.ink}
              stroke={sourceMode ? '#f1f3f4' : palette.paper}
              strokeWidth="5"
              paintOrder="stroke"
              data-untrusted-source="openstreetmap-name"
            >
              {feature.properties.name}
            </text>
          )
        })}
      </g>

      <path d="M60 70H1140" stroke={sourceMode ? '#202124' : palette.accent} strokeWidth="12" />
      <text x="64" y="157" className="poster-title" fontSize="88" letterSpacing="-0.025em" fill={sourceMode ? '#202124' : palette.ink}>
        {sourceMode ? 'SOURCE GEOMETRY' : posterTitle.toUpperCase()}
      </text>
      <text x="67" y="213" className="poster-copy" fontSize="27" fill={sourceMode ? '#5f6368' : palette.ink}>
        {sourceMode
          ? 'Neutral rendering — same IDs, bounds, projection, and hashes'
          : `${state.place.name} · every line from OpenStreetMap`}
      </text>
      <text x="67" y="260" className="poster-mono" fontSize="15" letterSpacing="0.12em" fill={sourceMode ? '#5f6368' : palette.accent}>
        {sourceMode ? 'NEUTRAL SOURCE VIEW' : state.place.name.toUpperCase()}
      </text>

      <rect x="60" y="1368" width="1080" height="1" fill={sourceMode ? '#dadce0' : palette.ink} />
      {spec.showLegend ? (
        <g data-legend="osm-layers">
          {legendLayers().map((item, index) => {
            const x = 60 + index * 210
            const swatch = item.key === 'park'
              ? { fill: sourceMode ? '#e6efe3' : palette.park, stroke: sourceMode ? '#c3d6bd' : palette.park }
              : item.key === 'water'
                ? { fill: 'none', stroke: sourceMode ? '#bfe0ff' : palette.water }
                : item.key === 'landmark'
                  ? { fill: sourceMode ? '#5f6368' : palette.ink, stroke: '#ffffff' }
                  : { fill: 'none', stroke: sourceMode ? '#9aa0a6' : palette.ink }
            return (
              <g key={item.key} data-legend-item={item.key}>
                {item.key === 'park' ? (
                  <rect x={x} y="1384" width="22" height="14" fill={swatch.fill} stroke={swatch.stroke} strokeWidth="1.5" />
                ) : item.key === 'landmark' ? (
                  <circle cx={x + 11} cy="1391" r="6" fill={swatch.fill} stroke={swatch.stroke} strokeWidth="1.5" />
                ) : (
                  <path d={`M${x} 1391h22`} fill="none" stroke={swatch.stroke} strokeWidth="3" strokeLinecap="round" />
                )}
                <text x={x + 30} y="1396" className="poster-mono" fontSize="13" fill={sourceMode ? '#5f6368' : palette.ink}>
                  {item.label}
                </text>
              </g>
            )
          })}
        </g>
      ) : null}
      <text x="60" y="1438" className="poster-mono" fontSize="15" fill={sourceMode ? '#5f6368' : palette.ink}>
        MAP DATA © OPENSTREETMAP CONTRIBUTORS · ODbL 1.0
      </text>
      <text x="1140" y="1438" className="poster-mono" textAnchor="end" fontSize="15" fill={sourceMode ? '#5f6368' : palette.ink}>
        {features.length.toLocaleString()} {state.data.lock?.kind === 'verified' ? 'OSM VERIFIED' : 'LIVE OSM'} FEATURES
      </text>
      <text x="60" y="1474" className="poster-mono" fontSize="13" fill={sourceMode ? '#5f6368' : palette.ink} opacity="0.7">
        MAPTRUTH / {state.data.lock?.sourceRevision?.toUpperCase() ?? 'NO LOCK'} / {state.data.lock?.geometryHash?.slice(0, 18) ?? 'VISIBLE-CONTEXT'}
      </text>
    </svg>
  )
}
