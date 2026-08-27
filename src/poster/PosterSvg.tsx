import type { SourceFeature } from '../types/maptruth'
import { contextBounds, featuresInContext } from '../map/context'

import { geometryAnchor, geometryToPath, projectPosition, type PosterFrame } from './projection'
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
    if (sourceRank <= 1) return { fill: 'none', stroke: '#80868b', strokeWidth: 2.6 }
    if (sourceRank <= 3) return { fill: 'none', stroke: '#9aa0a6', strokeWidth: 1.5 }
    return { fill: 'none', stroke: '#bdc1c6', strokeWidth: 0.9 }
  }
  if (feature.properties.type === 'park') return { fill: palette.park, stroke: 'none', strokeWidth: 0 }
  if (feature.properties.type === 'water') return { fill: palette.water, stroke: palette.water, strokeWidth: emphasized ? 6 : 3 }
  if (feature.properties.type === 'landmark') return { fill: emphasized ? palette.accent : palette.ink, stroke: palette.paper, strokeWidth: 2 }
  // Weight roads by importance so 4,000 paths still read as a street network
  // instead of one solid black scribble.
  const rank = feature.properties.rank ?? 7
  if (emphasized) return { fill: 'none', stroke: palette.accent, strokeWidth: 6 }
  // Vector tiles split each road into many short segments, so a few thousand
  // "roads" is really one dense web. Keep strokes light or the network turns
  // into a grey mat and buries the art layer underneath.
  if (rank <= 1) return { fill: 'none', stroke: palette.ink, strokeWidth: 3 }
  if (rank <= 3) return { fill: 'none', stroke: palette.ink, strokeWidth: 1.7 }
  if (rank <= 5) return { fill: 'none', stroke: '#5f6368', strokeWidth: 1 }
  return { fill: 'none', stroke: '#80868b', strokeWidth: 0.7 }
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
  const frame: PosterFrame = { width: 1200, height: 1180, padding: 40, bounds }
  const inContext = featuresInContext(state)
  // A printed map generalises: drawing every residential lane turns a poster
  // into grey noise and buries the generated art. Keep the network that gives a
  // city its shape. Everything drawn is still source-backed and hash-checked.
  const drawn = inContext.filter((feature) => feature.properties.type !== 'road' || (feature.properties.rank ?? 9) <= 5)
  const features = (drawn.length > 40 ? drawn : inContext).sort(
    (a, b) => layerOrder[a.properties.type] - layerOrder[b.properties.type],
  )
  // Whatever the prompt named, pinned at the coordinates OpenStreetMap gives
  // it — the poster answering the brief with evidence instead of the model
  // inventing a plausible location.
  const pinned = state.truthPins
  const emphasized = new Set(spec.emphasizedFeatureIds)
  const mapTransform = 'translate(0 150)'
  const posterTitle = posterTitleFromPrompt(state.ai.prompt, state.place.name)
  const overArt = Boolean(backgroundImage) && !sourceMode
  const headText = overArt ? '#ffffff' : sourceMode ? '#202124' : palette.ink
  const subText = overArt ? 'rgba(255,255,255,.86)' : '#5f6368'
  const headline = posterTitle.toUpperCase()
  // Barlow Condensed runs ~0.46em per glyph. Shrink to fit, then let SVG
  // compress the rest so a long prompt can never bleed off the canvas.
  const titleSize = Math.min(92, Math.max(46, Math.floor(1080 / (headline.length * 0.46))))
  const titleTooLong = headline.length * titleSize * 0.46 > 1080

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
        <clipPath id={`map-clip-${id ?? 'preview'}`}><rect x="0" y="150" width="1200" height="1180" /></clipPath>
        {/* Neutral scrims, not paper-coloured ones: the art decides the palette,
            MapTruth only has to stay legible on top of whatever it chose. */}
        <linearGradient id={`scrim-${id ?? 'preview'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0c0e" stopOpacity="0.72" />
          <stop offset="0.68" stopColor="#0b0c0e" stopOpacity="0.42" />
          <stop offset="1" stopColor="#0b0c0e" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`foot-${id ?? 'preview'}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0b0c0e" stopOpacity="0" />
          <stop offset="0.35" stopColor="#0b0c0e" stopOpacity="0.6" />
          <stop offset="1" stopColor="#0b0c0e" stopOpacity="0.82" />
        </linearGradient>
        <pattern id={`grid-${id ?? 'preview'}`} width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke={palette.ink} strokeOpacity="0.08" strokeWidth="1" />
        </pattern>
      </defs>
      <rect width="1200" height="1500" fill={sourceMode ? '#f1f3f4' : palette.paper} />
      {backgroundImage && !sourceMode ? (
        <>
          {/* The art layer carries the poster; scrims behind the type keep the
              copy legible without washing the whole image out. */}
          <image href={backgroundImage} width="1200" height="1500" preserveAspectRatio="xMidYMid slice" opacity="0.92" />
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
        {/* Truth pins: the real coordinates of whatever the prompt named. */}
        {pinned.map((pin) => {
          const [x, y] = projectPosition(pin.center, frame)
          return (
            <g key={`pin-${pin.term}`} data-truth-pin={pin.name} data-osm-center={pin.center.join(',')}>
              <circle cx={x} cy={y} r="26" fill="#ea4335" fillOpacity="0.18" />
              <path
                d={`M${x} ${y - 34}a15 15 0 0 1 15 15c0 11-15 27-15 27s-15-16-15-27a15 15 0 0 1 15-15z`}
                fill="#ea4335"
                stroke="#ffffff"
                strokeWidth="3.5"
                strokeLinejoin="round"
              />
              <circle cx={x} cy={y - 19} r="5.5" fill="#ffffff" />
            </g>
          )
        })}
        {pinned.map((pin) => {
          const [x, y] = projectPosition(pin.center, frame)
          return (
            <text
              key={`pin-label-${pin.term}`}
              x={x}
              y={y + 30}
              className="poster-title"
              textAnchor="middle"
              fontSize="30"
              fill="#141416"
              stroke="#ffffff"
              strokeWidth="7"
              paintOrder="stroke"
              data-untrusted-source="openstreetmap-name"
            >
              {pin.name}
            </text>
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
              fill="#141416"
              stroke="#ffffff"
              strokeWidth="5"
              paintOrder="stroke"
              data-untrusted-source="openstreetmap-name"
            >
              {feature.properties.name}
            </text>
          )
        })}
      </g>

      <rect width="1200" height="300" fill={backgroundImage && !sourceMode ? `url(#scrim-${id ?? 'preview'})` : palette.paper} />
      <text
        x="60"
        y="150"
        className="poster-title"
        fontSize={titleSize}
        letterSpacing="-0.025em"
        textLength={titleTooLong ? 1080 : undefined}
        lengthAdjust="spacingAndGlyphs"
        fill={headText}
      >
        {headline}
      </text>
      <text x="62" y="200" className="poster-copy" fontSize="26" fill={subText}>
        {`${state.place.name} · every line drawn from OpenStreetMap`}
      </text>
      {sourceMode ? (
        <text x="1140" y="200" className="poster-mono" textAnchor="end" fontSize="15" letterSpacing="0.12em" fill={subText}>
          SOURCE GEOMETRY
        </text>
      ) : null}

      <rect y="1330" width="1200" height="170" fill={backgroundImage && !sourceMode ? `url(#foot-${id ?? 'preview'})` : palette.paper} />
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
                  <rect x={x} y="1390" width="22" height="14" fill={swatch.fill} stroke={swatch.stroke} strokeWidth="1.5" />
                ) : item.key === 'landmark' ? (
                  <circle cx={x + 11} cy="1397" r="6" fill={swatch.fill} stroke={swatch.stroke} strokeWidth="1.5" />
                ) : (
                  <path d={`M${x} 1397h22`} fill="none" stroke={swatch.stroke} strokeWidth="3" strokeLinecap="round" />
                )}
                <text x={x + 30} y="1402" className="poster-mono" fontSize="13" fill={subText}>
                  {item.label}
                </text>
              </g>
            )
          })}
        </g>
      ) : null}
      <text x="60" y="1444" className="poster-mono" fontSize="15" fill={subText}>
        MAP DATA © OPENSTREETMAP CONTRIBUTORS · ODbL 1.0
      </text>
      <text x="1140" y="1444" className="poster-mono" textAnchor="end" fontSize="15" fill={subText}>
        {features.length === inContext.length
          ? `${features.length.toLocaleString()} ${state.data.lock?.kind === 'verified' ? 'OSM VERIFIED' : 'LIVE OSM'} FEATURES`
          : `${features.length.toLocaleString()} OF ${inContext.length.toLocaleString()} ${state.data.lock?.kind === 'verified' ? 'OSM VERIFIED' : 'LIVE OSM'} FEATURES`}
      </text>
      <text x="60" y="1478" className="poster-mono" fontSize="13" fill={subText} opacity="0.75">
        MAPTRUTH / {state.data.lock?.sourceRevision?.toUpperCase() ?? 'NO LOCK'} / {state.data.lock?.geometryHash?.slice(0, 18) ?? 'VISIBLE-CONTEXT'}
      </text>
    </svg>
  )
}
