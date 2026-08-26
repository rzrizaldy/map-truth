import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw'
import type { Feature, LineString, Polygon } from 'geojson'
import { hashGeometrySync } from '../lib/hash'
import { appStore, addActivity, useAppStore } from '../state/store'
import { demoRoute } from './context'

type MapStudioProps = { captureRef: React.MutableRefObject<(() => string) | null> }

const blankStyle: maplibregl.StyleSpecification = {
  version: 8,
  sources: {},
  layers: [{ id: 'paper', type: 'background', paint: { 'background-color': '#F2E7CF' } }],
}

const setSelection = (feature: Feature<LineString | Polygon>) => {
  const geometry = feature.geometry
  const kind = geometry.type === 'LineString' ? 'route' : 'area'
  const id = `human:${kind}`
  appStore.setState((state) => ({
    selection: { kind, id, geometry, geometryHash: hashGeometrySync(geometry) } as typeof state.selection,
    poster: { ...state.poster, status: 'ready' },
  }))
  addActivity('draw', 'ok', kind === 'route' ? 'Route locked with a 350 m context buffer' : 'Area selection locked')
}

export function MapStudio({ captureRef }: MapStudioProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const dataStatus = useAppStore((state) => state.data.status)
  const featureCount = useAppStore((state) => state.data.features.length)
  const selection = useAppStore((state) => state.selection)

  useEffect(() => {
    if (!containerRef.current || dataStatus !== 'ready') return
    const state = appStore.getState()
    const map: MapLibreMap = new maplibregl.Map({
      container: containerRef.current,
      style: blankStyle,
      center: state.map.center,
      zoom: state.map.zoom,
      minZoom: 11.4,
      maxZoom: 16,
      maxBounds: [[106.775, -6.245], [106.865, -6.145]],
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: false,
    })
    const mapElement = containerRef.current
    map.on('error', (event) => {
      const message = event.error?.message ?? 'MapLibre render error'
      mapElement.dataset.mapError = message
      addActivity('map', 'error', message)
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    const draw = new MaplibreTerradrawControl({
      modes: ['linestring', 'polygon', 'select', 'delete-selection', 'delete'],
      open: true,
      showDeleteConfirmation: false,
    })

    map.on('load', () => {
      mapElement.dataset.mapLoaded = 'true'
      map.addSource('osm', { type: 'geojson', data: '/data/demo-area.geojson' })
      map.addLayer({
        id: 'parks', type: 'fill', source: 'osm', filter: ['==', ['get', 'type'], 'park'],
        paint: { 'fill-color': '#B4B590', 'fill-opacity': 0.58, 'fill-outline-color': '#77796E' },
      })
      map.addLayer({
        id: 'water', type: 'line', source: 'osm', filter: ['==', ['get', 'type'], 'water'],
        paint: { 'line-color': '#688D97', 'line-width': 2.5 },
      })
      map.addLayer({
        id: 'roads', type: 'line', source: 'osm', filter: ['==', ['get', 'type'], 'road'],
        paint: { 'line-color': '#3F413D', 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 16, 3] },
      })
      map.addLayer({
        id: 'landmarks', type: 'circle', source: 'osm', filter: ['==', ['get', 'type'], 'landmark'],
        paint: { 'circle-radius': 5, 'circle-color': '#D43D28', 'circle-stroke-width': 2, 'circle-stroke-color': '#FFF9EC' },
      })
      map.addSource('demo-route', { type: 'geojson', data: { type: 'Feature', properties: {}, geometry: demoRoute } })
      map.addLayer({
        id: 'demo-route-casing', type: 'line', source: 'demo-route',
        paint: { 'line-color': '#FFF9EC', 'line-width': 10 },
      })
      map.addLayer({
        id: 'demo-route-line', type: 'line', source: 'demo-route',
        paint: { 'line-color': '#D43D28', 'line-width': 5 },
      })
      map.addControl(draw, 'top-left')
      const terra = draw.getTerraDrawInstance()
      const sync = () => {
        const latest = terra?.getSnapshot().filter((item) => item.geometry.type === 'LineString' || item.geometry.type === 'Polygon').at(-1)
        if (latest) setSelection(latest as Feature<LineString | Polygon>)
      }
      terra?.on('finish', sync)
      terra?.on('change', sync)
      if (!appStore.getState().selection) {
        setSelection({ type: 'Feature', properties: { source: 'maptruth-demo' }, geometry: demoRoute })
      }
      map.once('idle', () => {
        const loaded = map.querySourceFeatures('osm').length
        mapElement.dataset.featureCount = String(loaded)
        addActivity('map', loaded ? 'ok' : 'error', `${loaded.toLocaleString()} source fragments painted by MapLibre`)
      })
    })

    map.on('moveend', () => {
      const bounds = map.getBounds()
      const center = map.getCenter()
      appStore.setState({
        map: {
          center: [center.lng, center.lat],
          zoom: map.getZoom(),
          bbox: [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()],
        },
      })
    })
    captureRef.current = () => map.getCanvas().toDataURL('image/png')
    return () => {
      captureRef.current = null
      map.remove()
    }
  }, [dataStatus, captureRef])

  return (
    <div className="map-shell">
      <div className="map-meta">
        <span>LOCAL EXTRACT</span>
        <strong>{featureCount.toLocaleString()} features</strong>
        <span>{selection?.kind === 'route' ? '350 m route context' : 'direct area context'}</span>
      </div>
      <div ref={containerRef} className="map-canvas" aria-label="Interactive source map of Central Jakarta and Senayan" />
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        Map data © OpenStreetMap contributors
      </a>
    </div>
  )
}
