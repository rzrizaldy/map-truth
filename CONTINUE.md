# MapTruth — continuation handoff

Live: [map-truth.vercel.app](https://map-truth.vercel.app)

## Shape now

- **One page, three steps.** `StudioPage` renders hero → step 1 lock → step 2 prompt → step 3 compare → proof seam → receipts. `/demo` and `/about` redirect to `/`.
- **Google Maps palette.** Light surfaces, grey type, one blue accent (`--blue: #1a73e8`). Tokens live in `src/index.css`; the map overlay and `PosterSvg` follow the same colours.
- Two Vercel Functions only: `api/generate-route.ts` and `api/osm-extract.ts`. Shared code lives in `api/_lib/`, tests are excluded by `.vercelignore`.

## Hard-won invariants

- **API routes must export named methods** (`export function POST`). A default export is read as `(req, res)`; the returned `Response` is discarded and every request hangs until timeout.
- **Verify a geometry hash with the function that produced it.** Live tile features use `hashGeometrySync` (`fnv1a:` prefix); Overpass features use SHA-256. Use `geometryHashMatches`.
- **`navigate_map` must settle tiles before resolving**, or an agent's immediate `lock_live_osm` sees an empty source.
- **Never truncate the feature set by draw order.** Budget per class and rank by importance, or roads vanish behind parks and whole neighbourhoods render bare.
- Never label tile-derived fragments as canonical OSM entities. Only a successful Overpass replacement earns `OSM VERIFIED`.
- Route 3 GPT output is an art layer only: no roads, water, routes, boundaries, labels, place names, landmarks, icons, coordinates, or map silhouettes.
- Manual mode stays complete when `document.modelContext` is absent.
- Agent-triggered generation stops at a visible cost approval gate.
- No fake generated images, no client-side API keys, no bundled city data.

## Primary files

- `src/map/liveOsm.ts` — classification, ranking, per-class budget, viewport clipping, lock identity
- `src/map/MapStudio.tsx` — MapLibre source queries, overlay, tile settling, cache, runtime adapter
- `src/webmcp/register.ts` + `commands.ts` — eight tool contracts and manual parity
- `src/ai/generation.ts` — per-route client state and approval staging
- `api/generate-route.ts`, `api/osm-extract.ts` — validated Web handlers
- `src/pages/Studio.tsx`, `src/components/ComparisonGrid.tsx` — the three-step journey

## Open item

`WEBMCP_ORIGIN_TRIAL_TOKEN` is not configured, so production Chrome reports Manual mode unless the tester enables `chrome://flags/#enable-webmcp-testing`. Register the origin trial and set it as a Vercel **build** env var to make agent mode discoverable for ordinary visitors. Do not claim WebMCP acceptance until a connected Chrome discovers and executes all eight tools against the deployed origin.
