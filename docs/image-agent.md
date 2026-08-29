# MapTruth image agent

## Mission

Keep the two-route comparison honest, and keep the grounded route provably tied to live OSM-derived source geometry.

## Route contract

| Route | Evidence | Geographic claim |
|---|---|---|
| `promptOnly` | The brief alone | Invented |
| `screenshotGrounded` | Brief + a live, located, pinned OpenStreetMap capture, plus a compact lock summary | A redraw sourced from the real place |

Both run independently through `POST /api/generate-route`, report
`idle | awaiting_approval | queued | generating | ready | error | cancelled`,
preserve partial success, and support focused retry.

## Non-negotiable rules

- Use real `gpt-image-2` output; never return a placeholder from an API.
- Keep `OPENAI_API_KEY` server-side.
- The grounded route's evidence is the captured map. Anything that must reach the
  model — pins especially — has to be drawn on the live map before capture.
- Its prompt must tell the model to follow the attached map and not invent
  streets, districts or landmarks that are not visible in it.
- `markerCount` must include every marker layer painted into the capture: the
  subject pin, category overlays, and OSM-resolved named places.
- Verify the source capture and provenance. Never describe generated pixels as
  cartographically exact or themselves verified.
- Manual and WebMCP actions must call the same command functions.
- WebMCP generation stages requests and waits for visible human approval.
- Preserve OSM attribution in both cards.

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

Google Maps palette: surface `#FFFFFF` on `#F8F9FA`, text `#202124`, secondary `#5F6368`, borders `#DADCE0`, accent blue `#1A73E8`, park `#CDEAC4`, water `#AADAFF`, pin red `#EA4335`. Barlow Condensed for headings, Source Sans 3 for copy, IBM Plex Mono for data. The signature is the selectable execution receipt: clicking one highlights its affected source paths. Keep loading states honest, without gradients, generic spinners, sparkles, or chat bubbles.

## Verification checklist

- The prompt-only route starts as soon as the map is ready.
- The grounded route clearly requests a lock when missing and starts immediately after one exists.
- Results arrive independently; a failure does not discard the other routes.
- Cancellation copy states that the provider request may still finish server-side.
- Pins appear on the live map, so they survive into the capture.
- Manual mode works without `document.modelContext`.
- Connected Chrome is not reported as WebMCP-complete until it discovers all ten tools. Page scripts cannot execute a browser-owned `RegisteredTool`; execution is covered through the same command functions in the walkthrough and Playwright.
