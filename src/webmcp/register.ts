import { appStore } from '../state/store'
import {
  exportGroundedArtwork,
  focusPlace,
  generateComparison,
  markFromOsm,
  getMapContext,
  inspectComparison,
  lockLiveOsm,
  navigateMap,
  verifyGeography,
  verifyOsmLock,
} from './commands'
import {
  EXPORT_ARTWORK_SCHEMA,
  FOCUS_PLACE_SCHEMA,
  GENERATE_COMPARISON_SCHEMA,
  MARK_FROM_OSM_SCHEMA,
  INSPECT_COMPARISON_SCHEMA,
  INSPECT_MAP_CONTEXT_SCHEMA,
  LOCK_LIVE_OSM_SCHEMA,
  NAVIGATE_MAP_SCHEMA,
  VERIFY_GEOGRAPHY_SCHEMA,
  VERIFY_OSM_LOCK_SCHEMA,
} from './schemas'

export const registerMapTruthTools = async (): Promise<() => void> => {
  if (!document.modelContext) {
    appStore.setState((state) => ({
      ui: {
        ...state.ui,
        webmcpAvailable: false,
        webmcpStatus: 'unavailable',
        webmcpMessage: 'Manual mode. Every button here is the same function the agent calls. For agent mode, open this page in Chrome with chrome://flags/#enable-webmcp-testing enabled, or deploy with a WebMCP origin-trial token.',
      },
    }))
    return () => undefined
  }

  const controller = new AbortController()
  try {
    await Promise.all([
      document.modelContext.registerTool({
        name: 'inspect_map_context', title: 'Inspect live map context',
        description: 'Read the current viewport, live OSM lock, verification state, and up to 20 visible feature references.',
        inputSchema: INSPECT_MAP_CONTEXT_SCHEMA,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: (input) => getMapContext(input as { detail?: 'summary' | 'features' }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'navigate_map', title: 'Navigate the map',
        description: 'Move the camera to validated longitude, latitude, and zoom. Camera coordinates never become artwork geometry.',
        inputSchema: NAVIGATE_MAP_SCHEMA,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => navigateMap(input as { center?: unknown; zoom?: unknown; label?: unknown }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'focus_place', title: 'Focus the map on a named place',
        description: 'Move the map to a place named in plain language (for example "Jakarta") and lock its live OSM geometry. Use this to ground generation in the place a prompt is actually about.',
        inputSchema: FOCUS_PLACE_SCHEMA,
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: (input) => focusPlace(input as { place?: unknown; lock?: unknown }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'lock_live_osm', title: 'Lock live OSM viewport',
        description: 'Create an immediate, traceable geometry lock from the OSM vector tiles already loaded in the visible viewport.',
        inputSchema: LOCK_LIVE_OSM_SCHEMA,
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: () => lockLiveOsm('webmcp'),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'verify_osm_lock', title: 'Verify with canonical OSM',
        description: 'Upgrade the active live-tile lock through Overpass. A failed verification preserves the current live lock.',
        inputSchema: VERIFY_OSM_LOCK_SCHEMA,
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: () => verifyOsmLock(),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'mark_from_osm', title: 'Mark what the brief asks for',
        description: 'Work out which kinds of place the current brief needs — gathering points, medical posts, transit and so on — then mark the real ones from OpenStreetMap on the map itself, so they are inside any capture.',
        inputSchema: MARK_FROM_OSM_SCHEMA,
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: () => markFromOsm(),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'generate_comparison', title: 'Stage GPT Image comparison',
        description: 'Stage one or more gpt-image-2 routes. The page requires visible user approval before any costed request begins.',
        inputSchema: GENERATE_COMPARISON_SCHEMA,
        annotations: { readOnlyHint: false, untrustedContentHint: true },
        execute: (input) => generateComparison(input as { routes?: unknown; prompt?: unknown }),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'inspect_comparison', title: 'Inspect image comparison',
        description: 'Read compact per-route progress, errors, duration, and prompt lineage for the current comparison.',
        inputSchema: INSPECT_COMPARISON_SCHEMA,
        annotations: { readOnlyHint: true, untrustedContentHint: true },
        execute: () => inspectComparison(),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'verify_geography', title: 'Verify rendered geography',
        description: 'Recompute feature hashes, activate the truth seam, and report mismatches without changing coordinates.',
        inputSchema: VERIFY_GEOGRAPHY_SCHEMA,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: () => verifyGeography(),
      }, { signal: controller.signal }),
      document.modelContext.registerTool({
        name: 'export_artwork', title: 'Export generated artwork',
        description: 'Download a completed generated image. Defaults to the grounded route; its inspectable source provenance remains visible in the page.',
        inputSchema: EXPORT_ARTWORK_SCHEMA,
        annotations: { readOnlyHint: false, untrustedContentHint: false },
        execute: (input) => exportGroundedArtwork(input as { route?: unknown }),
      }, { signal: controller.signal }),
    ])
    appStore.setState((state) => ({
      ui: { ...state.ui, webmcpAvailable: true, webmcpStatus: 'available', webmcpMessage: 'Agent mode active · 10 visible MapTruth tools registered.' },
    }))
  } catch (error) {
    controller.abort()
    appStore.setState((state) => ({
      ui: { ...state.ui, webmcpAvailable: false, webmcpStatus: 'error', webmcpMessage: `WebMCP registration failed: ${String(error)}` },
    }))
  }
  return () => controller.abort()
}
