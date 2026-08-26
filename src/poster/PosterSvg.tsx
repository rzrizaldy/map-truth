import type { SourceFeature } from '../types/maptruth'
import { contextBounds, featuresInContext } from '../map/context'
import { geometryAnchor, geometryToPath, type PosterFrame } from './projection'
import { useAppStore } from '../state/store'
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
  'red-cream-black': { paper: '#F2E7CF', ink: '#141512', accent: '#D43D28', water: '#657A7D', park: '#A9AD86' },
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
    if (feature.properties.type === 'park') return { fill: '#DADBD1', stroke: '#85877F', strokeWidth: 1 }
    if (feature.properties.type === 'water') return { fill: 'none', stroke: '#789BA4', strokeWidth: 3 }
    if (feature.properties.type === 'landmark') return { fill: '#141512', stroke: '#FFF9EC', strokeWidth: 2 }
    return { fill: 'none', stroke: '#7C7E78', strokeWidth: emphasized ? 5 : 2 }
  }
  if (feature.properties.type === 'park') return { fill: palette.park, stroke: palette.ink, strokeWidth: 1.2 }
  if (feature.properties.type === 'water') return { fill: 'none', stroke: palette.water, strokeWidth: emphasized ? 7 : 4 }
  if (feature.properties.type === 'landmark') return { fill: emphasized ? palette.accent : palette.ink, stroke: palette.paper, strokeWidth: 2.5 }
  return { fill: 'none', stroke: emphasized ? palette.accent : palette.ink, strokeWidth: emphasized ? 7 : 2.4 }
}

const shouldLabel = (feature: SourceFeature, density: string, index: number, emphasized: boolean) => {
  if (!feature.properties.name) return false
  if (emphasized || feature.properties.type === 'landmark') return true
  if (density === 'minimal') return false
  if (density === 'balanced') return index % 18 === 0
  return index % 8 === 0
}

const legendLayers = (hasRoute: boolean) => [
  { key: 'road', label: 'Roads' },
  { key: 'water', label: 'Water' },
  { key: 'park', label: 'Parks' },
  { key: 'landmark', label: 'Landmarks' },
  ...(hasRoute ? [{ key: 'route', label: 'Drawn route' }] : []),
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
  const routePath = state.selection ? geometryToPath(state.selection.geometry, frame) : ''
  const frameCode = `${bounds[0].toFixed(3)} / ${bounds[1].toFixed(3)} — ${bounds[2].toFixed(3)} / ${bounds[3].toFixed(3)}`

  return (
    <svg
      id={id}
      className={className}
      viewBox="0 0 1200 1500"
      role="img"
      aria-label={sourceMode ? 'Neutral source map' : `${spec.title} grounded poster`}
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
      <rect width="1200" height="1500" fill={sourceMode ? '#ECECE5' : palette.paper} />
      {backgroundImage && !sourceMode ? (
        <image href={backgroundImage} width="1200" height="1500" preserveAspectRatio="xMidYMid slice" opacity="0.82" />
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
              opacity={feature.properties.type === 'road' && !isEmphasized ? 0.72 : 1}
              data-source-id={feature.properties.id}
              data-geometry-hash={feature.properties.geometryHash}
              data-feature-class={feature.properties.type}
            />
          )
        })}
        {routePath ? (
          <>
            <path d={routePath} fill="none" stroke={sourceMode ? '#FFF9EC' : palette.paper} strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
            <path
              d={routePath}
              fill="none"
              stroke={sourceMode ? '#D43D28' : palette.accent}
              strokeWidth="9"
              strokeLinecap="round"
              strokeLinejoin="round"
              data-source-id={state.selection?.id}
              data-geometry-hash={state.selection?.geometryHash}
              data-feature-class="human-geometry"
            />
          </>
        ) : null}
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
              fill={sourceMode ? '#141512' : palette.ink}
              stroke={sourceMode ? '#ECECE5' : palette.paper}
              strokeWidth="5"
              paintOrder="stroke"
              data-untrusted-source="openstreetmap-name"
            >
              {feature.properties.name}
            </text>
          )
        })}
      </g>

      <path d="M60 70H1140" stroke={sourceMode ? '#141512' : palette.accent} strokeWidth="12" />
      <text x="64" y="157" className="poster-title" fontSize="88" letterSpacing="-0.025em" fill={sourceMode ? '#141512' : palette.ink}>
        {sourceMode ? 'SOURCE GEOMETRY' : spec.title.toUpperCase()}
      </text>
      <text x="67" y="213" className="poster-copy" fontSize="27" fill={sourceMode ? '#62645D' : palette.ink}>
        {sourceMode ? 'Neutral rendering — same IDs, bounds, projection, and hashes' : spec.subtitle}
      </text>
      <text x="67" y="260" className="poster-mono" fontSize="15" letterSpacing="0.12em" fill={sourceMode ? '#62645D' : palette.accent}>
        CENTRAL JAKARTA — SENAYAN  /  {frameCode}
      </text>

      <rect x="60" y="1368" width="1080" height="1" fill={sourceMode ? '#62645D' : palette.ink} />
      {spec.showLegend ? (
        <g data-legend="osm-layers">
          {legendLayers(Boolean(state.selection)).map((item, index) => {
            const x = 60 + index * 210
            const swatch = item.key === 'park'
              ? { fill: sourceMode ? '#DADBD1' : palette.park, stroke: sourceMode ? '#85877F' : palette.ink }
              : item.key === 'water'
                ? { fill: 'none', stroke: sourceMode ? '#789BA4' : palette.water }
                : item.key === 'landmark'
                  ? { fill: sourceMode ? '#141512' : palette.ink, stroke: sourceMode ? '#FFF9EC' : palette.paper }
                  : { fill: 'none', stroke: item.key === 'route' ? (sourceMode ? '#D43D28' : palette.accent) : (sourceMode ? '#7C7E78' : palette.ink) }
            return (
              <g key={item.key} data-legend-item={item.key}>
                {item.key === 'park' ? (
                  <rect x={x} y="1384" width="22" height="14" fill={swatch.fill} stroke={swatch.stroke} strokeWidth="1.5" />
                ) : item.key === 'landmark' ? (
                  <circle cx={x + 11} cy="1391" r="6" fill={swatch.fill} stroke={swatch.stroke} strokeWidth="1.5" />
                ) : (
                  <path d={`M${x} 1391h22`} fill="none" stroke={swatch.stroke} strokeWidth={item.key === 'route' ? 5 : 3} strokeLinecap="round" />
                )}
                <text x={x + 30} y="1396" className="poster-mono" fontSize="13" fill={sourceMode ? '#62645D' : palette.ink}>
                  {item.label}
                </text>
              </g>
            )
          })}
        </g>
      ) : null}
      <text x="60" y="1438" className="poster-mono" fontSize="15" fill={sourceMode ? '#62645D' : palette.ink}>
        MAP DATA © OPENSTREETMAP CONTRIBUTORS · ODbL 1.0
      </text>
      <text x="1140" y="1438" className="poster-mono" textAnchor="end" fontSize="15" fill={sourceMode ? '#62645D' : palette.ink}>
        {features.length.toLocaleString()} VERIFIED FEATURES
      </text>
      <text x="60" y="1474" className="poster-mono" fontSize="13" fill={sourceMode ? '#62645D' : palette.ink} opacity="0.7">
        MAPTRUTH / GEOMETRY-LOCKED RENDER / {state.selection?.geometryHash?.slice(0, 18) ?? 'VISIBLE-CONTEXT'}
      </text>
    </svg>
  )
}
