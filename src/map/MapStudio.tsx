import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl'
import { bboxToPolygon, formatPlaceLabel, liveBboxSpanOk } from './boundary'
import { featuresInContext } from './context'
import { OPENFREEMAP_STYLE } from './constants'
import { createLiveLock, liveLockCacheKey, normalizeViewportFeatures, type ViewportCandidate } from './liveOsm'
import { readCachedLock, writeCachedLock } from './lockCache'
import { registerMapRuntime } from './runtime'
import { hashGeometrySync } from '../lib/hash'
import { addActivity, appStore, useAppStore } from '../state/store'
import { captureUndo } from '../state/history'
import type { SourceFeature, ToolResult } from '../types/maptruth'

const featureCollection = (features: SourceFeature[]) => ({ type: 'FeatureCollection' as const, features })

const addLockOverlay = (map: MapLibreMap) => {
  if (map.getSource('maptruth-lock')) return
  map.addSource('maptruth-lock', { type: 'geojson', data: featureCollection([]) })
  map.addLayer({
    id: 'maptruth-lock-areas', type: 'fill', source: 'maptruth-lock',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    paint: { 'fill-color': ['match', ['get', 'type'], 'water', '#6f98a2', 'park', '#a8ad82', '#d43d28'], 'fill-opacity': 0.23, 'fill-outline-color': '#141512' },
  })
  map.addLayer({
    id: 'maptruth-lock-lines', type: 'line', source: 'maptruth-lock',
    filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
    paint: { 'line-color': ['match', ['get', 'type'], 'water', '#4f8290', 'road', '#d43d28', '#141512'], 'line-width': 2.2, 'line-opacity': 0.78 },
  })
  map.addLayer({
    id: 'maptruth-lock-points', type: 'circle', source: 'maptruth-lock',
    filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
    paint: { 'circle-radius': 4.5, 'circle-color': '#d43d28', 'circle-stroke-width': 2, 'circle-stroke-color': '#fff9ec' },
  })
  map.addLayer({
    id: 'maptruth-lock-areas-selected', type: 'fill', source: 'maptruth-lock',
    filter: ['==', ['get', 'id'], '__none__'],
    paint: { 'fill-color': '#d43d28', 'fill-opacity': 0.48 },
  })
  map.addLayer({
    id: 'maptruth-lock-lines-selected', type: 'line', source: 'maptruth-lock',
    filter: ['==', ['get', 'id'], '__none__'],
    paint: { 'line-color': '#fff9ec', 'line-width': 6 },
  })
  map.addLayer({
    id: 'maptruth-lock-points-selected', type: 'circle', source: 'maptruth-lock',
    filter: ['==', ['get', 'id'], '__none__'],
    paint: { 'circle-radius': 8, 'circle-color': '#fff9ec', 'circle-stroke-width': 3, 'circle-stroke-color': '#d43d28' },
  })
}

const candidatesFromMap = (map: MapLibreMap): ViewportCandidate[] => {
  const style = map.getStyle()
  const sourceLayers = new Map<string, Set<string>>()
  for (const layer of style.layers ?? []) {
    if (!('source' in layer) || typeof layer.source !== 'string' || !('source-layer' in layer) || typeof layer['source-layer'] !== 'string') continue
    const layers = sourceLayers.get(layer.source) ?? new Set<string>()
    layers.add(layer['source-layer'])
    sourceLayers.set(layer.source, layers)
  }

  const candidates: ViewportCandidate[] = []
  for (const [source, layers] of sourceLayers) {
    for (const sourceLayer of layers) {
      try {
        for (const feature of map.querySourceFeatures(source, { sourceLayer })) {
          candidates.push({
            source,
            sourceLayer,
            id: feature.id,
            properties: feature.properties as Record<string, unknown>,
            geometry: feature.geometry,
          })
        }
      } catch {
        // Some styles expose rendered features but not source-feature queries.
      }
    }
  }

  if (candidates.length) return candidates
  return map.queryRenderedFeatures().map((feature: MapGeoJSONFeature) => ({
    source: feature.source,
    sourceLayer: feature.sourceLayer ?? feature.layer.id,
    layerId: feature.layer.id,
    id: feature.id,
    properties: feature.properties as Record<string, unknown>,
    geometry: feature.geometry,
  }))
}

const boundsTuple = (map: MapLibreMap): [number, number, number, number] => {
  const bounds = map.getBounds()
  return [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()]
}

const captureMapScreenshot = (map: MapLibreMap) => {
  const source = map.getCanvas()
  const scale = Math.min(1, 1_280 / source.width, 900 / source.height)
  const screenshot = document.createElement('canvas')
  screenshot.width = Math.max(1, Math.round(source.width * scale))
  screenshot.height = Math.max(1, Math.round(source.height * scale))
  const context = screenshot.getContext('2d')
  if (!context) throw new Error('screenshot_context_unavailable')
  context.drawImage(source, 0, 0, screenshot.width, screenshot.height)
  return screenshot.toDataURL('image/jpeg', 0.82)
}

export function MapStudio() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const features = useAppStore((state) => state.data.features)
  const selectedReceipt = useAppStore((state) => state.activity.find((entry) => entry.id === state.ui.selectedReceiptId))

  useEffect(() => {
    if (!containerRef.current) return
    const initial = appStore.getState().map
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: OPENFREEMAP_STYLE,
      center: initial.center,
      zoom: initial.zoom,
      minZoom: 2,
      maxZoom: 18,
      canvasContextAttributes: { preserveDrawingBuffer: true },
      attributionControl: false,
    })
    mapRef.current = map
    const mapElement = containerRef.current
    let invalidateOnMoveEnd = false

    // `moveend` fires before the new viewport's tiles are requested, so an agent
    // that locks immediately would see an empty source. Wait for a fresh `idle`.
    const settleTiles = (timeoutMs = 12_000) => new Promise<void>((resolve) => {
      const finish = () => {
        window.clearTimeout(timer)
        map.off('idle', finish)
        resolve()
      }
      const timer = window.setTimeout(finish, timeoutMs)
      map.on('idle', finish)
    })

    const lockLiveOsm = async (source: 'manual' | 'webmcp' = 'manual'): Promise<ToolResult> => {
      const startedAt = performance.now()
      const bbox = boundsTuple(map)
      const zoom = map.getZoom()
      if (!map.loaded() || !map.isStyleLoaded()) {
        addActivity('lock_live_osm', 'needs_user_action', 'The vector map is still loading', { source })
        return { status: 'needs_user_action', reason: 'map_not_ready', suggestedAction: 'wait_for_map' }
      }
      if (!liveBboxSpanOk(bbox)) {
        addActivity('lock_live_osm', 'needs_user_action', 'Zoom closer before creating a live OSM lock', { source })
        return { status: 'needs_user_action', reason: 'bbox_too_large', suggestedAction: 'zoom_in' }
      }

      appStore.setState((state) => ({ data: { ...state.data, status: 'loading', error: undefined } }))
      const cacheKey = liveLockCacheKey(bbox, zoom)
      const cached = await readCachedLock(cacheKey)
      let normalized = cached?.features ?? normalizeViewportFeatures(candidatesFromMap(map))
      if (!normalized.length && !map.areTilesLoaded()) {
        // Tiles for this viewport are still arriving. Give them one settle pass
        // before telling the caller there is nothing here.
        await settleTiles()
        normalized = normalizeViewportFeatures(candidatesFromMap(map))
      }
      if (!normalized.length) {
        appStore.setState((state) => ({ data: { ...state.data, status: 'error', error: 'No supported OSM features are loaded. Zoom closer or move the map.' } }))
        addActivity('lock_live_osm', 'error', 'No supported OSM features were available in the loaded tiles', { source, durationMs: Math.round(performance.now() - startedAt) })
        return { status: 'error', reason: 'no_supported_features' }
      }
      const lock = cached?.lock ?? createLiveLock(normalized, bbox, zoom)
      captureUndo('live OSM lock')
      const polygon = bboxToPolygon(bbox)
      const selection = { kind: 'area' as const, id: 'human:viewport', geometry: polygon, geometryHash: hashGeometrySync(polygon) }
      const seeded = { ...appStore.getState(), data: { ...appStore.getState().data, status: 'ready' as const, features: normalized, lock }, selection }
      const renderedFeatureIds = featuresInContext(seeded).map((feature) => feature.properties.id)
      appStore.setState((state) => ({
        data: { status: 'ready', features: normalized, lock, verificationStatus: 'idle' },
        place: { name: formatPlaceLabel(bbox), source: 'live' },
        selection,
        poster: { ...state.poster, status: 'ready', renderedFeatureIds, warnings: ['Viewport-tile geometry; use Verify with Overpass for canonical OSM IDs.'] },
        ui: { ...state.ui, canUndo: true },
      }))
      void writeCachedLock(cacheKey, { lock, features: normalized })
      const durationMs = Math.round(performance.now() - startedAt)
      addActivity('lock_live_osm', 'ok', `${normalized.length.toLocaleString()} live OSM features locked${cached ? ' from viewport cache' : ''}`, {
        source, durationMs, afterHash: lock.geometryHash, affectedFeatureIds: renderedFeatureIds.slice(0, 80), reversible: true,
      })
      return { status: 'ok', lockId: lock.id, lockType: 'live_osm', featureCount: normalized.length, geometryHash: lock.geometryHash, durationMs }
    }

    const unregisterRuntime = registerMapRuntime({
      capture: () => captureMapScreenshot(map),
      lockLiveOsm,
      navigate: async (center, zoom) => {
        invalidateOnMoveEnd = true
        map.easeTo({ center, zoom, duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 650 })
        await new Promise<void>((resolve) => map.once('moveend', () => resolve()))
        await settleTiles()
      },
    })

    map.on('error', (event) => {
      const message = event.error?.message ?? 'MapLibre render error'
      mapElement.dataset.mapError = message
      addActivity('map', 'error', message, { source: 'system' })
    })
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    const resize = () => map.resize()
    window.addEventListener('resize', resize)

    map.on('load', () => {
      addLockOverlay(map)
      resize()
      // A stalled tile request must not leave the studio permanently disabled:
      // fall back to ready once the style itself has rendered.
      let announcedReady = false
      const announceReady = (viaTimeout: boolean) => {
        if (announcedReady) return
        announcedReady = true
        window.clearTimeout(readyTimer)
        map.off('idle', onIdle)
        mapElement.dataset.mapLoaded = 'true'
        appStore.setState((state) => ({ ui: { ...state.ui, mapReady: true } }))
        addActivity('map_ready', 'ok', viaTimeout
          ? 'Map is interactive; some OSM tiles are still arriving'
          : 'Live OpenStreetMap vector sources are ready', { source: 'system' })
      }
      const onIdle = () => announceReady(false)
      const readyTimer = window.setTimeout(() => announceReady(true), 10_000)
      map.on('idle', onIdle)
    })

    map.on('movestart', (event) => {
      // MapLibre also moves while the canvas is resized. Only a real pointer,
      // keyboard, wheel, or explicit agent navigation invalidates the lock.
      if ((event as typeof event & { originalEvent?: Event }).originalEvent) invalidateOnMoveEnd = true
    })

    map.on('moveend', () => {
      const bbox = boundsTuple(map)
      const center = map.getCenter()
      const previous = appStore.getState()
      const movedAway = invalidateOnMoveEnd && previous.data.lock && previous.data.lock.bbox.some((value, index) => Math.abs(value - bbox[index]) > 0.0005)
      invalidateOnMoveEnd = false
      appStore.setState((state) => ({
        map: { center: [center.lng, center.lat], zoom: map.getZoom(), bbox },
        ...(movedAway ? {
          data: { status: 'idle' as const, features: [], verificationStatus: 'idle' as const },
          selection: undefined,
          poster: { ...state.poster, status: 'empty' as const, renderedFeatureIds: [], warnings: [] },
          ai: { ...state.ai, routes: { ...state.ai.routes, mapTruthGrounded: { status: 'idle' as const } } },
        } : {}),
      }))
    })

    return () => {
      window.removeEventListener('resize', resize)
      unregisterRuntime()
      map.remove()
      mapRef.current = null
      appStore.setState((state) => ({ ui: { ...state.ui, mapReady: false } }))
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded() || !map.getSource('maptruth-lock')) return
    ;(map.getSource('maptruth-lock') as maplibregl.GeoJSONSource).setData(featureCollection(features))
  }, [features])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const ids = selectedReceipt?.affectedFeatureIds ?? []
    const filter: maplibregl.FilterSpecification = ids.length ? ['in', ['get', 'id'], ['literal', ids]] : ['==', ['get', 'id'], '__none__']
    for (const suffix of ['areas', 'lines', 'points']) {
      const layerId = `maptruth-lock-${suffix}-selected`
      if (map.getLayer(layerId)) map.setFilter(layerId, filter)
    }
  }, [selectedReceipt])

  const data = useAppStore((state) => state.data)
  const metaLabel = data.lock?.kind === 'verified' ? 'OSM VERIFIED' : data.lock ? 'LIVE OSM LOCK' : 'LIVE VECTOR VIEWPORT'

  return (
    <div className="map-shell map-shell--demo">
      <div className="map-meta">
        <span>{metaLabel}</span>
        <strong>{data.features.length ? `${data.features.length.toLocaleString()} features` : 'Pan · zoom · lock'}</strong>
        <span>{data.lock ? data.lock.geometryHash.slice(0, 15) : 'no lock yet'}</span>
      </div>
      <div ref={containerRef} className="map-canvas" aria-label="Interactive worldwide OpenStreetMap vector map" />
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        Map data © OpenStreetMap contributors
      </a>
    </div>
  )
}
