import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap } from 'maplibre-gl'
import { MaplibreTerradrawControl } from '@watergis/maplibre-gl-terradraw'
import type { Feature, LineString, Polygon } from 'geojson'
import { hashGeometrySync } from '../lib/hash'
import { appStore, addActivity, useAppStore } from '../state/store'
import { demoRoute } from './context'
import {
  JAKARTA_MAX_BOUNDS,
  NYC_CENTER,
  NYC_ZOOM,
  OPENFREEMAP_STYLE,
} from './constants'

type MapStudioProps = {
  mode: 'about' | 'demo'
  captureRef: React.MutableRefObject<(() => string) | null>
}

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

const addOsmOverlay = (map: MapLibreMap, collection: GeoJSON.FeatureCollection) => {
  if (map.getSource('osm')) {
    ;(map.getSource('osm') as maplibregl.GeoJSONSource).setData(collection)
    return
  }
  map.addSource('osm', { type: 'geojson', data: collection })
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
    paint: { 'line-color': '#3F413D', 'line-opacity': 0.75, 'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.5, 16, 3] },
  })
  map.addLayer({
    id: 'landmarks', type: 'circle', source: 'osm', filter: ['==', ['get', 'type'], 'landmark'],
    paint: { 'circle-radius': 5, 'circle-color': '#D43D28', 'circle-stroke-width': 2, 'circle-stroke-color': '#FFF9EC' },
  })
}

export function MapStudio({ mode, captureRef }: MapStudioProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const dataStatus = useAppStore((state) => state.data.status)
  const featureCount = useAppStore((state) => state.data.features.length)
  const selection = useAppStore((state) => state.selection)
  const features = useAppStore((state) => state.data.features)
  const mapReady = mode === 'demo' || dataStatus === 'ready'

  useEffect(() => {
    if (!containerRef.current || !mapReady) return

    const state = appStore.getState()
    const map: MapLibreMap = new maplibregl.Map({
      container: containerRef.current,
      style: mode === 'demo' ? OPENFREEMAP_STYLE : blankStyle,
      center: mode === 'demo' ? NYC_CENTER : state.map.center,
      zoom: mode === 'demo' ? NYC_ZOOM : state.map.zoom,
      minZoom: mode === 'demo' ? 2 : 11.4,
      maxZoom: 18,
      maxBounds: mode === 'demo' ? undefined : JAKARTA_MAX_BOUNDS,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: false,
    })
    mapRef.current = map
    const mapElement = containerRef.current

    map.on('error', (event) => {
      const message = event.error?.message ?? 'MapLibre render error'
      mapElement.dataset.mapError = message
      addActivity('map', 'error', message)
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')

    const onResize = () => map.resize()
    window.addEventListener('resize', onResize)
    requestAnimationFrame(onResize)

    map.on('load', () => {
      mapElement.dataset.mapLoaded = 'true'
      onResize()

      if (mode === 'about') {
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
        map.addLayer({ id: 'demo-route-casing', type: 'line', source: 'demo-route', paint: { 'line-color': '#FFF9EC', 'line-width': 10 } })
        map.addLayer({ id: 'demo-route-line', type: 'line', source: 'demo-route', paint: { 'line-color': '#D43D28', 'line-width': 5 } })

        const draw = new MaplibreTerradrawControl({
          modes: ['linestring', 'polygon', 'select', 'delete-selection', 'delete'],
          open: true,
          showDeleteConfirmation: false,
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
        const reportFragments = () => {
          if (mapElement.dataset.featureCount) return
          const loaded = map.querySourceFeatures('osm').length
          mapElement.dataset.featureCount = String(loaded)
          addActivity('map', loaded ? 'ok' : 'error', `${loaded.toLocaleString()} source fragments painted by MapLibre`)
        }
        map.once('idle', reportFragments)
        map.on('sourcedata', (event) => {
          if (event.sourceId === 'osm' && event.isSourceLoaded) reportFragments()
        })
      } else {
        addActivity('map', 'ok', 'Worldwide OSM vector basemap ready — zoom in and set boundary')
      }
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
      window.removeEventListener('resize', onResize)
      captureRef.current = null
      map.remove()
      mapRef.current = null
    }
  }, [mode, mapReady, captureRef])

  useEffect(() => {
    if (mode !== 'demo' || !mapRef.current?.isStyleLoaded()) return
    if (!features.length) return
    const collection = { type: 'FeatureCollection' as const, features }
    if (!mapRef.current.getSource('osm')) {
      addOsmOverlay(mapRef.current, collection)
    } else {
      ;(mapRef.current.getSource('osm') as maplibregl.GeoJSONSource).setData(collection)
    }
  }, [mode, features])

  const metaLabel = mode === 'demo'
    ? (dataStatus === 'ready' && featureCount ? 'OSM EXTRACT LOCKED' : 'WORLDWIDE VECTOR BASEMAP')
    : 'LOCAL EXTRACT'

  return (
    <div className={`map-shell ${mode === 'demo' ? 'map-shell--demo' : ''}`}>
      <div className="map-meta">
        <span>{metaLabel}</span>
        <strong>{featureCount ? `${featureCount.toLocaleString()} features` : 'Pan · zoom · lock'}</strong>
        <span>{selection?.kind === 'route' ? '350 m route context' : selection ? 'viewport boundary' : 'no boundary yet'}</span>
      </div>
      <div
        ref={containerRef}
        className="map-canvas"
        aria-label={mode === 'demo' ? 'Interactive worldwide OpenStreetMap vector map' : 'Interactive source map of Central Jakarta and Senayan'}
      />
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        Map data © OpenStreetMap contributors
      </a>
    </div>
  )
}
