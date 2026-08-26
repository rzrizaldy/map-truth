import { appStore } from '../state/store'
import {
  exportGroundedArtwork,
  getDrawnGeometry,
  getMapContext,
  lockMapBoundary,
  renderGroundedPoster,
  verifyGeography,
} from './commands'
import {
  EXPORT_ARTWORK_SCHEMA,
  GET_DRAWN_GEOMETRY_SCHEMA,
  GET_MAP_CONTEXT_SCHEMA,
  LOCK_MAP_BOUNDARY_SCHEMA,
  RENDER_POSTER_SCHEMA,
  VERIFY_GEOGRAPHY_SCHEMA,
} from './schemas'

export const registerMapTruthTools = async (): Promise<() => void> => {
  if (!document.modelContext) {
    appStore.setState((state) => ({
      ui: {
        ...state.ui,
        webmcpAvailable: false,
        webmcpStatus: 'unavailable',
        webmcpMessage: 'WebMCP is unavailable here. Manual controls remain fully functional.',
      },
    }))
    return () => undefined
  }

  const controller = new AbortController()
  try {
    await Promise.all([
      document.modelContext.registerTool(
        {
          name: 'lock_map_boundary',
          title: 'Lock map boundary',
          description: 'Lock geography to the current map viewport and fetch OpenStreetMap vectors for that area. Never accepts coordinates from the agent.',
          inputSchema: LOCK_MAP_BOUNDARY_SCHEMA,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: () => lockMapBoundary(),
        },
        { signal: controller.signal },
      ),
      document.modelContext.registerTool(
        {
          name: 'get_map_context',
          title: 'Inspect map context',
          description: 'Return the current map bounds, selection state, and a compact catalog of visible source-backed features.',
          inputSchema: GET_MAP_CONTEXT_SCHEMA,
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: (input) => getMapContext(input as { detail?: 'summary' | 'features' }),
        },
        { signal: controller.signal },
      ),
      document.modelContext.registerTool(
        {
          name: 'get_drawn_geometry',
          title: 'Read drawn geometry',
          description: 'Return the human-drawn route or selected polygon without altering it.',
          inputSchema: GET_DRAWN_GEOMETRY_SCHEMA,
          annotations: { readOnlyHint: true, untrustedContentHint: true },
          execute: () => getDrawnGeometry(),
        },
        { signal: controller.signal },
      ),
      document.modelContext.registerTool(
        {
          name: 'render_grounded_poster',
          title: 'Render grounded poster',
          description: 'Apply art direction using only validated feature IDs and human-drawn geometry. Never accepts coordinates or arbitrary markup.',
          inputSchema: RENDER_POSTER_SCHEMA,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input) => renderGroundedPoster(input),
        },
        { signal: controller.signal },
      ),
      document.modelContext.registerTool(
        {
          name: 'verify_geography',
          title: 'Verify geography',
          description: 'Activate source comparison and report provenance for every rendered geographic layer.',
          inputSchema: VERIFY_GEOGRAPHY_SCHEMA,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: () => verifyGeography(),
        },
        { signal: controller.signal },
      ),
      document.modelContext.registerTool(
        {
          name: 'export_artwork',
          title: 'Export artwork',
          description: 'Prepare PNG or SVG artwork from the verified source-backed render, including OpenStreetMap attribution.',
          inputSchema: EXPORT_ARTWORK_SCHEMA,
          annotations: { readOnlyHint: false, untrustedContentHint: false },
          execute: (input) => exportGroundedArtwork(input as { format?: unknown }),
        },
        { signal: controller.signal },
      ),
    ])
    appStore.setState((state) => ({
      ui: {
        ...state.ui,
        webmcpAvailable: true,
        webmcpStatus: 'available',
        webmcpMessage: 'Six MapTruth tools are registered on this page.',
      },
    }))
  } catch (error) {
    controller.abort()
    appStore.setState((state) => ({
      ui: {
        ...state.ui,
        webmcpAvailable: false,
        webmcpStatus: 'error',
        webmcpMessage: `WebMCP registration failed: ${String(error)}`,
      },
    }))
  }

  return () => controller.abort()
}

