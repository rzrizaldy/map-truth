import { useEffect, useRef } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { Map as MapLibreMap, MapGeoJSONFeature } from 'maplibre-gl'
import { bboxToPolygon, formatPlaceLabel, liveBboxSpanOk } from './boundary'
import { featuresInContext } from './context'
import { OPENFREEMAP_STYLE } from './constants'
import { createLiveLock, liveLockCacheKey, normalizeViewportFeatures, type ViewportCandidate } from './liveOsm'
import { readCachedLock, writeCachedLock } from './lockCache'
import { registerMapRuntime } from './runtime'
import { describeViewport } from './geocode'
import { hashGeometrySync } from '../lib/hash'
import { addActivity, appStore, useAppStore } from '../state/store'
import { captureUndo } from '../state/history'
import type { SourceFeature, ToolResult } from '../types/maptruth'

const featureCollection = (features: SourceFeature[]) => ({ type: 'FeatureCollection' as const, features })

// Pins live on the map itself, not on a separate art layer, so they are inside
// the screenshot the image model receives. That is the whole point: the model
// is shown where the thing actually is instead of guessing.
const addPinLayer = (map: MapLibreMap) => {
  if (map.getSource('maptruth-pins')) return
  map.addSource('maptruth-pins', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
  map.addLayer({
    id: 'maptruth-pin-halo', type: 'circle', source: 'maptruth-pins',
    paint: { 'circle-radius': 26, 'circle-color': '#ea4335', 'circle-opacity': 0.16 },
  })
  map.addLayer({
    id: 'maptruth-pin-dot', type: 'circle', source: 'maptruth-pins',
    paint: { 'circle-radius': 9, 'circle-color': '#ea4335', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
  })
  map.addLayer({
    id: 'maptruth-pin-label', type: 'symbol', source: 'maptruth-pins',
    layout: {
      'text-field': ['get', 'name'],
      'text-font': ['Noto Sans Bold'],
      'text-size': 15,
      'text-offset': [0, -1.9],
      'text-anchor': 'bottom',
      'text-allow-overlap': true,
    },
    paint: { 'text-color': '#141416', 'text-halo-color': '#ffffff', 'text-halo-width': 2.2 },
  })
}

const addLockOverlay = (map: MapLibreMap) => {
  if (map.getSource('maptruth-lock')) return
  map.addSource('maptruth-lock', { type: 'geojson', data: featureCollection([]) })
  map.addLayer({
    id: 'maptruth-lock-areas', type: 'fill', source: 'maptruth-lock',
    filter: ['in', ['geometry-type'], ['literal', ['Polygon', 'MultiPolygon']]],
    paint: { 'fill-color': ['match', ['get', 'type'], 'water', '#aadaff', 'park', '#cdeac4', '#1a73e8'], 'fill-opacity': 0.5, 'fill-outline-color': '#1a73e8' },
  })
  map.addLayer({
    id: 'maptruth-lock-lines', type: 'line', source: 'maptruth-lock',
    filter: ['in', ['geometry-type'], ['literal', ['LineString', 'MultiLineString']]],
    paint: { 'line-color': ['match', ['get', 'type'], 'water', '#4285f4', 'road', '#1a73e8', '#5f6368'], 'line-width': 2, 'line-opacity': 0.8 },
  })
  map.addLayer({
    id: 'maptruth-lock-points', type: 'circle', source: 'maptruth-lock',
    filter: ['in', ['geometry-type'], ['literal', ['Point', 'MultiPoint']]],
    paint: { 'circle-radius': 4.5, 'circle-color': '#ea4335', 'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff' },
  })
  map.addLayer({
    id: 'maptruth-lock-areas-selected', type: 'fill', source: 'maptruth-lock',
    filter: ['==', ['get', 'id'], '__none__'],
    paint: { 'fill-color': '#f9ab00', 'fill-opacity': 0.55 },
  })
  map.addLayer({
    id: 'maptruth-lock-lines-selected', type: 'line', source: 'maptruth-lock',
    filter: ['==', ['get', 'id'], '__none__'],
    paint: { 'line-color': '#f9ab00', 'line-width': 6 },
  })
  map.addLayer({
    id: 'maptruth-lock-points-selected', type: 'circle', source: 'maptruth-lock',
    filter: ['==', ['get', 'id'], '__none__'],
    paint: { 'circle-radius': 8, 'circle-color': '#f9ab00', 'circle-stroke-width': 3, 'circle-stroke-color': '#ffffff' },
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
  const pins = useAppStore((state) => state.truthPins)
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
      // Both `map.loaded()` and `isStyleLoaded()` report false while any tile is
      // in flight, which is most of the time just after a camera move. Refusing
      // on that told agents the map was not ready while thousands of features
      // sat queryable. Wait once, then judge by what can actually be read.
      if (!map.isStyleLoaded()) await settleTiles()
      if (!liveBboxSpanOk(bbox)) {
        addActivity('lock_live_osm', 'needs_user_action', 'Zoom closer before creating a live OSM lock', { source })
        return { status: 'needs_user_action', reason: 'bbox_too_large', suggestedAction: 'zoom_in' }
      }

      appStore.setState((state) => ({ data: { ...state.data, status: 'loading', error: undefined } }))
      const cacheKey = liveLockCacheKey(bbox, zoom)
      const cached = await readCachedLock(cacheKey)
      let normalized = cached?.features ?? normalizeViewportFeatures(candidatesFromMap(map), undefined, undefined, bbox)
      if (!normalized.length && !map.areTilesLoaded()) {
        // Tiles for this viewport are still arriving. Give them one settle pass
        // before telling the caller there is nothing here.
        await settleTiles()
        normalized = normalizeViewportFeatures(candidatesFromMap(map), undefined, undefined, bbox)
      }
      if (!normalized.length) {
        // Nothing readable. Distinguish "still loading" from "genuinely empty
        // here", because only one of them is worth retrying.
        if (!map.isStyleLoaded()) {
          appStore.setState((state) => ({ data: { ...state.data, status: 'idle' } }))
          addActivity('lock_live_osm', 'needs_user_action', 'The vector map is still loading', { source })
          return { status: 'needs_user_action', reason: 'map_not_ready', suggestedAction: 'wait_for_map' }
        }
        appStore.setState((state) => ({ data: { ...state.data, status: 'error', error: 'No supported OSM features are loaded. Zoom closer or move the map.' } }))
        addActivity('lock_live_osm', 'error', 'No supported OSM features were available in the loaded tiles', { source, durationMs: Math.round(performance.now() - startedAt) })
        return { status: 'error', reason: 'no_supported_features' }
      }
      const lock = cached?.lock ?? createLiveLock(normalized, bbox, zoom)
      // A caller that just focused a named place already knows where this is;
      // relabelling it with coordinates would throw that grounding away.
      const previousPlace = appStore.getState().place
      const keepNamedPlace = previousPlace.source === 'geocoded'
        && previousPlace.name.length > 0
      captureUndo('live OSM lock')
      const polygon = bboxToPolygon(bbox)
      const selection = { kind: 'area' as const, id: 'human:viewport', geometry: polygon, geometryHash: hashGeometrySync(polygon) }
      const seeded = { ...appStore.getState(), data: { ...appStore.getState().data, status: 'ready' as const, features: normalized, lock }, selection }
      const renderedFeatureIds = featuresInContext(seeded).map((feature) => feature.properties.id)
      appStore.setState((state) => ({
        data: { status: 'ready', features: normalized, lock, verificationStatus: 'idle' },
        place: keepNamedPlace
          ? previousPlace
          : { name: formatPlaceLabel(bbox), source: 'live', resolving: true },
        selection,
        ui: { ...state.ui, canUndo: true },
      }))
      void writeCachedLock(cacheKey, { lock, features: normalized })
      // Coordinates mean nothing to a newcomer, and a mismatch with the prompt
      // is invisible without a real name. Resolve it in the background so the
      // lock itself is never delayed.
      if (!keepNamedPlace) void describeViewport([(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]).then((place) => {
        if (!place) {
          appStore.setState((state) => ({ place: { ...state.place, resolving: false } }))
          return
        }
        appStore.setState((state) => (state.data.lock?.id === lock.id
          ? { place: { name: place.name, label: place.label, source: 'live', resolving: false } }
          : { place: { ...state.place, resolving: false } }))
      })
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

    // If the basemap style itself never arrives — slow venue wifi, a blocked
    // tile host — the page would otherwise sit forever behind a disabled
    // button with nothing to explain it.
    const styleWatchdog = window.setTimeout(() => {
      if (map.isStyleLoaded()) return
      mapElement.dataset.mapError = 'style_timeout'
      appStore.setState((state) => ({
        data: {
          ...state.data,
          status: state.data.features.length ? state.data.status : 'error',
          error: 'The map is taking unusually long to load. Check your connection, then reload.',
        },
      }))
      addActivity('map', 'error', 'Basemap style did not load in time', { source: 'system' })
    }, 20_000)
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'bottom-right')
    const resize = () => map.resize()
    window.addEventListener('resize', resize)

    // Readiness is armed from construction, not from `load`: on a slow style
    // fetch the fallback timer used to start several seconds late and the
    // studio could sit disabled well past the point it was usable.
    let announcedReady = false
    const announceReady = (viaTimeout: boolean) => {
      if (announcedReady) return
      announcedReady = true
      window.clearTimeout(readyTimer)
      window.clearTimeout(styleWatchdog)
      map.off('idle', onIdle)
      mapElement.dataset.mapLoaded = 'true'
      appStore.setState((state) => ({ ui: { ...state.ui, mapReady: true } }))
      addActivity('map_ready', 'ok', viaTimeout
        ? 'Map is interactive; some OSM tiles are still arriving'
        : 'Live OpenStreetMap vector sources are ready', { source: 'system' })
    }
    const onIdle = () => announceReady(false)
    let readyTimer = 0

    map.on('load', () => {
      window.clearTimeout(styleWatchdog)
      addLockOverlay(map)
      addPinLayer(map)
      resize()
      map.on('idle', onIdle)
      // The style is up, so the map is usable. `idle` waits for every tile and
      // on a busy network may never arrive; don't hold the studio hostage to it.
      readyTimer = window.setTimeout(() => announceReady(true), 8_000)
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
          truthPins: [],
          ai: { ...state.ai, routes: { ...state.ai.routes, mapTruthGrounded: { status: 'idle' as const } } },
        } : {}),
      }))
    })

    return () => {
      window.clearTimeout(styleWatchdog)
      window.clearTimeout(readyTimer)
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
    if (!map?.isStyleLoaded() || !map.getSource('maptruth-pins')) return
    ;(map.getSource('maptruth-pins') as maplibregl.GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: pins.map((pin) => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: pin.center },
        properties: { name: pin.name },
      })),
    })
  }, [pins])

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
  const metaLabel = data.lock?.kind === 'verified' ? 'Confirmed with OpenStreetMap' : data.lock ? 'Using this view' : 'Live OpenStreetMap'

  return (
    <div className="map-shell map-shell--demo">
      <div className="map-meta">
        <span>{metaLabel}</span>
        <strong>{data.features.length ? `${data.features.length.toLocaleString()} real shapes` : 'Drag to explore'}</strong>
        <span>{data.lock ? '' : 'nothing picked yet'}</span>
      </div>
      <div ref={containerRef} className="map-canvas" aria-label="Interactive worldwide OpenStreetMap vector map" />
      <a className="map-attribution" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
        Map data © OpenStreetMap contributors
      </a>
    </div>
  )
}
