# MapTruth — continuation handoff

Live target: [map-truth.vercel.app](https://map-truth.vercel.app)

## Architecture now

- `/demo` opens a worldwide OpenFreeMap/OSM vector basemap at New York.
- `/about` uses the same live pipeline with a Jakarta starting camera and TerraDraw.
- No city GeoJSON, PBF, feature index, or data-preparation script ships with the app.
- `MapStudio` extracts supported features directly from loaded vector sources, creates traceable `tile:` IDs, hashes exact tile geometry, and caches viewport locks in IndexedDB.
- `Verify with Overpass` optionally upgrades a live lock to canonical `osm:` IDs. Failure preserves the live lock and never blocks routes 01/02/03.
- `/api/generate-route` runs one real `gpt-image-2` route. The compatibility `/api/generate-comparison` wrapper remains.
- WebMCP registers eight agent-canvas tools. Every invocation shares manual command functions and leaves a visible receipt.

## Product invariants

- Never label tile-derived fragments as canonical OSM entities.
- Only successful Overpass replacement receives `OSM VERIFIED` status.
- Route 03 GPT output is an art layer. It must never supply roads, water, routes, boundaries, labels, place names, landmarks, icons, coordinates, or map silhouettes.
- Manual mode remains complete when `document.modelContext` is absent.
- Agent-triggered image generation stops at a visible cost approval gate.
- No fake generated images, client-side API keys, hidden agent mutations, or bundled city data.

## Primary files

- `src/map/liveOsm.ts` — classification, deterministic viewport IDs, lock identity
- `src/map/MapStudio.tsx` — MapLibre source queries, overlay, cache, runtime adapter
- `src/webmcp/register.ts` and `commands.ts` — eight tool contracts and manual parity
- `src/ai/generation.ts` — independent client route state and approval staging
- `api/generate-route.ts` — validated single-route image generation
- `src/components/StudioPanels.tsx` — context ribbon and tool receipts
- `src/components/ComparisonGrid.tsx` — per-route progress, retry, cancellation, preview ladder

## Acceptance boundary

CI and ordinary browser acceptance can validate the complete manual path. WebMCP completion must remain explicitly blocked until connected Chrome exposes `document.modelContext.registerTool`, discovers all eight tools, and successfully executes them against the deployed origin.
