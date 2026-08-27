# MapTruth image agent

## Mission

Keep the three-level comparison honest, and keep level 3 provably tied to live OSM geometry.

## Route contract

| Route | Evidence | Geographic claim |
|---|---|---|
| `promptOnly` | The brief alone | Unverified |
| `screenshotGrounded` | Brief + captured MapLibre viewport | Visually guided; topology may drift |
| `mapTruthGrounded` | Brief + screenshot as composition reference + compact lock summary | GPT art only; deterministic vectors supply the geography |

Each route runs independently through `POST /api/generate-route`, reports `idle | awaiting_approval | queued | generating | ready | error | cancelled`, preserves partial success, and supports focused retry.

## Non-negotiable rules

- Use real `gpt-image-2` output; never return a placeholder from an API.
- Keep `OPENAI_API_KEY` server-side.
- Level 3's prompt must prohibit generated roads, rivers, routes, boundaries, maps, labels, place names, landmarks, icons, coordinates, and geographic silhouettes.
- Render level 3 through `PosterSvg`, with `data-source-id` and `data-geometry-hash` on every geographic path, and keep the art layer muted enough that those vectors stay legible.
- Manual and WebMCP actions must call the same command functions.
- WebMCP generation stages requests and waits for visible human approval.
- Preserve OSM attribution in all three cards and every export.

## API handler shape

Vercel reads a **default** export as the Node `(req, res)` signature and discards a returned `Response`, so every request hangs until the function times out. API routes must export named methods:

```ts
export async function POST(request: Request): Promise<Response> { … }
```

Files under `api/` each become a function. Shared modules live in `api/_lib/` (leading underscore is not routed) and tests are excluded by `.vercelignore`.

## Live-lock semantics

- `LIVE OSM LOCK` means exact OSM-derived tile fragments in the current viewport, with `tile:` identities and a source revision.
- `OSM VERIFIED` means Overpass returned canonical entities and replaced those fragments.
- Overpass is never a prerequisite for generation.
- Verify a geometry hash with the function that produced it: `hashGeometrySync` (`fnv1a:` prefix) for tile features, SHA-256 for Overpass features. Use `geometryHashMatches`.
- When the viewport holds more features than the cap, budget per class and rank by importance. Truncating a draw-order sort starves roads and leaves whole neighbourhoods bare.
- Runtime IndexedDB caching is allowed; bundled city data is not.

## Visual language

Google Maps palette: surface `#FFFFFF` on `#F8F9FA`, text `#202124`, secondary `#5F6368`, borders `#DADCE0`, accent blue `#1A73E8`, park `#CDEAC4`, water `#AADAFF`. Barlow Condensed for headings, Source Sans 3 for copy, IBM Plex Mono for data. The signature is the selectable execution receipt: clicking one highlights its affected source paths. Keep loading states honest, without gradients, generic spinners, sparkles, or chat bubbles.

## Verification checklist

- Levels 1 and 2 start as soon as the map is ready.
- Level 3 clearly requests a live lock when missing and starts immediately after one exists.
- Results arrive independently; a failure does not discard the other routes.
- Cancellation copy states that the provider request may still finish server-side.
- The truth seam uses the same feature IDs, bounds, projection, and geometry hashes as the source view.
- Manual mode works without `document.modelContext`.
- Connected Chrome is not reported as WebMCP-complete until it discovers and executes all eight tools.
