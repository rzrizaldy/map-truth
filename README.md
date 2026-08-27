# MapTruth

[![CI](https://github.com/rzrizaldy/map-truth/actions/workflows/ci.yml/badge.svg)](https://github.com/rzrizaldy/map-truth/actions/workflows/ci.yml)

MapTruth is an agent-first WebMCP map-art experiment. Pan a worldwide OpenStreetMap vector map, lock the live viewport in milliseconds, and compare three real GPT Image routes: prompt only, screenshot grounded, and deterministic MapTruth geography over a generated art layer.

## Live OSM, no bundled city dataset

Both `/demo` and `/about` use the OpenFreeMap vector style. MapTruth inspects the vector sources already loaded by MapLibre with `querySourceFeatures`, falling back to `queryRenderedFeatures`, and normalizes supported roads, water, parks, and landmarks.

- Tile-derived IDs use `tile:<source-layer>:<source-id>:<geometry-hash>` and are never presented as canonical OSM IDs.
- Locks record viewport, zoom, source revision, feature provenance, and geometry hashes.
- IndexedDB caches runtime locks by viewport and source revision. Nothing is bundled at build time.
- `Verify with Overpass` is an optional upgrade to canonical `osm:` identifiers. A timeout preserves the live lock.
- Map data © OpenStreetMap contributors under the ODbL. Attribution appears in the interface and exports.

## Three independent GPT Image routes

`/api/generate-route` validates and runs one `gpt-image-2` route per request:

1. `promptOnly` receives the art brief alone.
2. `screenshotGrounded` receives the automatically captured MapLibre viewport as high-fidelity image context.
3. `mapTruthGrounded` receives the screenshot and a compact lock summary, but is explicitly prohibited from drawing geography. MapTruth composites exact source paths above its art layer.

The UI tracks each route independently, preserves partial success, supports per-route retry and local cancellation, and never substitutes fake generated images. `/api/generate-comparison` remains as a compatibility wrapper.

For local development:

```bash
npm install
npm run dev
```

To exercise server-side image generation locally, run `vercel dev` and set `OPENAI_API_KEY` in `.env.local`. Never expose it through a `VITE_` variable. On Vercel the endpoint may alternatively use the configured AI Gateway model ID `openai/gpt-image-2`.

## Agent-first WebMCP canvas

When `document.modelContext` is available, the page registers eight imperative tools:

- `inspect_map_context`
- `navigate_map`
- `lock_live_osm`
- `verify_osm_lock`
- `generate_comparison`
- `inspect_comparison`
- `verify_geography`
- `export_artwork`

Every invocation uses the same command functions as the manual UI. Mutating actions leave visible selectable receipts, affected features highlight on the map, and costed generation stops at a visible approval gate. When WebMCP is absent, the page reports Manual mode and remains fully functional.

Local WebMCP testing requires Chrome with `chrome://flags/#enable-webmcp-testing` enabled and relaunched. Production discovery additionally requires a valid `WEBMCP_ORIGIN_TRIAL_TOKEN`, emitted by `vercel.ts` only when configured.

## Verification and deployment

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
npx @vercel/config compile vercel.ts
```

Unit tests cover live tile classification and deduplication, stable locks, route-specific API validation, prompt safety, geographic hash verification, unsafe text escaping, and export attribution. Playwright covers the landing, live demo states, manual fallback, the Jakarta starting camera, responsive comparison narrative, and downloads.

GitHub Actions runs lint, type-check, unit tests, production build, and desktop/mobile Chromium on pushes and pull requests to `main`. Failed E2E runs upload traces and screenshots. Vercel’s Git integration deploys passing `main` revisions to [map-truth.vercel.app](https://map-truth.vercel.app).

MapTruth verifies provenance against the OSM-derived geometry available to the current runtime. It does not claim OpenStreetMap is perfectly complete or current, and it does not claim WebMCP acceptance until connected Chrome exposes and successfully executes `document.modelContext.registerTool`.
