# MapTruth Image Agent

## Mission

Maintain the three-route `gpt-image-2` comparison while keeping route 03 provably tied to live OSM geometry.

## Route contract

| Route | Evidence | Geographic claim |
|---|---|---|
| `promptOnly` | Prompt only | Unverified |
| `screenshotGrounded` | Prompt plus captured MapLibre viewport | Visually guided; topology may drift |
| `mapTruthGrounded` | Screenshot plus compact live-lock summary | GPT art only; deterministic vectors provide geography |

Each route runs independently through `/api/generate-route`, reports `idle | awaiting_approval | queued | generating | ready | error | cancelled`, preserves partial success, and supports focused retry.

## Non-negotiable rules

- Use real `gpt-image-2` output; never return a placeholder from an API.
- Keep `OPENAI_API_KEY` server-side.
- Route 03’s prompt must prohibit generated roads, rivers, routes, boundaries, maps, labels, place names, landmarks, icons, coordinates, and geographic silhouettes.
- Render route 03 through `PosterSvg`, with `data-source-id` and `data-geometry-hash` on every geographic path.
- Manual and WebMCP actions must call the same command functions.
- WebMCP generation stages requests and waits for visible human approval.
- Preserve OSM attribution in all three cards and every export.

## Live-lock semantics

- `LIVE OSM LOCK` means exact OSM-derived tile fragments loaded in the current viewport, with `tile:` identities and a source revision.
- `OSM VERIFIED` means Overpass returned canonical entities and replaced the active tile fragments.
- Overpass is never a prerequisite for generation.
- Runtime IndexedDB caching is allowed; bundled city data is not.

## Visual language

Use survey paper `#F2E7CF`, carbon `#141512`, dispatch red `#D43D28`, Barlow Condensed, Source Sans 3, and IBM Plex Mono. The signature is the selectable execution receipt: clicking one highlights its affected source paths. Keep loading states editorial and honest, without gradients, generic spinners, sparkles, or chat bubbles.

## Verification checklist

- Routes 01/02 start as soon as the map is ready.
- Route 03 clearly requests a live lock when missing and starts immediately after one exists.
- Results arrive independently and failures do not discard other routes.
- Cancellation copy states that a server/provider request may still finish.
- The truth seam uses the same feature IDs, bounds, projection, and geometry hashes as the source view.
- Manual mode works without `document.modelContext`.
- Connected Chrome is not reported as WebMCP-complete until it discovers and executes all eight tools.
