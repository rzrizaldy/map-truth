# MapTruth

[![CI](https://github.com/rzrizaldy/map-truth/actions/workflows/ci.yml/badge.svg)](https://github.com/rzrizaldy/map-truth/actions/workflows/ci.yml)

**A made-up map looks exactly like a real one.**

### → [map-truth.vercel.app](https://map-truth.vercel.app)

Ask any image model for a map of somewhere real and it invents the streets — confidently, beautifully, with a legend and emergency numbers. Fine for wall art. Dangerous for a protest route, an evacuation plan or a delivery zone.

MapTruth gives the model a sourced view of the actual place instead. Choose a place, write a brief, and an agent locks the OSM-derived viewport, resolves markers through OpenStreetMap, and hands that evidence over. Same prompt, both ways.

![The same prompt with and without a real map](public/example/comparison.jpg)

Both images came from *"Protest safety map — DPR Jakarta. Show gathering points and medical posts."*

- **Left, ungrounded.** Gathering points, medical posts, road closures, emergency numbers, an official-looking DPR RI seal. Every location in it is invented. Someone planning from it goes to the wrong places.
- **Right, grounded.** A generative redraw made from the sourced street layout around the parliament complex. Its legend is built from names resolved inside the locked view: Lapangan Panahan, Lapangan Tennis MPR Senayan, Taman Kridaloka, Posyandu RW 02, RSAL dr. Mintohardjo, Kimia Farma. The source line records coordinates and OSM-derived shapes and links to OpenStreetMap for inspection.

MapTruth read the brief, decided it needed gathering points and medical posts, asked OpenStreetMap where those actually are near the parliament, and marked them on the map *before* handing it over. The model styled a sourced map instead of starting from imagination. MapTruth verifies the evidence it received, not the cartographic precision of every generated pixel.

The dangerous one is the prettier one. That is the whole problem.

## Try it in 60 seconds

1. Open the site and choose a place through the search field, or use a one-click example. The map flies there and locks the visible source shapes.
2. Write the map you need. MapTruth reads back the place, marker categories, and any named suggestions that OpenStreetMap actually resolved.
3. Open **Manual mode** or **Agent mode · 10 tools** to watch the same WebMCP command functions run with visible receipts and a human approval gate.
4. Hit **Make both maps** for your own run (real `gpt-image-2` calls). Click either result for full screen, and follow **Check on OpenStreetMap** to inspect the source location.
5. Read [About + architecture](https://map-truth.vercel.app/about) for the system boundary and the claims MapTruth deliberately does not make.

## Why this is a WebMCP project

Agents are starting to browse and act on the web, and they will confidently produce spatial content that is wrong. WebMCP lets a page hand an agent real, typed tools instead of hoping it clicks the right pixels — so a site can supply verified ground truth instead of letting a model infer it from pixels.

MapTruth exposes ten tools:

`inspect_map_context` · `navigate_map` · `focus_place` · `lock_live_osm` · `verify_osm_lock` · `mark_from_osm` · `generate_comparison` · `inspect_comparison` · `verify_geography` · `export_artwork`

`mark_from_osm` is where the reasoning happens, and the split is deliberate: **the model decides what kind of thing a brief needs — gathering points, medical posts, transit — and OpenStreetMap decides where those things actually are.** The model picks categories from a closed vocabulary. For briefs asking for “top” or “famous” places it may suggest high-confidence names, but never coordinates; every name is resolved inside the lock and dropped if OpenStreetMap cannot find it. All surviving markers are painted before capture.

The other one that matters is `focus_place`: an assistant grounds an image in "Jakarta", or in the DPR building, by *naming* it — and the page answers with a located, hashed, attributed map it can verify afterwards. `navigate_map` waits for the new viewport's tiles to settle before resolving, so an agent that immediately calls `lock_live_osm` gets real geometry rather than an empty source.

Every tool calls the same functions the buttons do. Mutating actions leave visible, selectable receipts; costed generation stops at a visible approval gate. With no WebMCP the page reports **Manual mode** and stays fully usable.

### Verify the WebMCP integration yourself

```bash
npm run verify:webmcp
```

Launches your installed Chrome with the WebMCP feature on (the command-line equivalent of `chrome://flags/#enable-webmcp-testing`), loads the **live production site**, and asks the browser's own `document.modelContext.getTools()` what the page registered. Nothing is mocked. Verified on Chrome 151:

```
ok    document.modelContext is exposed by the browser
ok    all 10 tools registered and discoverable
ok    every tool publishes an input schema
ok    every tool describes itself
ok    only the two inspect tools claim readOnlyHint
ok    the page reports "Agent mode · 10 tools"
```

**Watch an assistant do it** on the page runs those same functions in the open, for browsers without WebMCP — not a mock of the tools, the tools, with their real receipts and the same cost gate.

### Enabling agent mode

- **Challenge testing:** ChatGPT's in-app Browser supports WebMCP directly. In Chrome 149+, enable `chrome://flags/#enable-webmcp-testing` and relaunch.
- **Stock Chrome:** production is registered for the WebMCP origin trial. Its token is stored as the Vercel **build** environment variable `WEBMCP_ORIGIN_TRIAL_TOKEN`, and `vercel.ts` emits the `Origin-Trial` header. The current trial covers Chrome 149–156 and ends November 16, 2026; feature detection keeps Manual mode working when it is unavailable.

## The journey

Two screens, each owning the viewport. The page does not scroll.

**1 · Ask.** Brief on the left, map on the right. The map is the read-back: it flies to the place the brief names as you write it, locks the view, pins the subject and marks what was asked for. Alongside, in words: the place it resolved, and what it will mark. A brief that names nowhere says so rather than quietly generating the wrong city.

**2 · Compare.** The two results side by side, each with its source line.

Three starter briefs are one click each — `Peta demo DPR Jakarta`, `New York landmarks & subway`, `Pittsburgh bike trail`. Agent tooling, hashes, Overpass re-verification and tool receipts live behind the mode badge. `/about` is a dedicated architecture and truth-contract page; the old `/demo` route still lands on the studio.

### Choosing what to mark

Marking is deliberately split. The model reads the brief and picks from a **closed vocabulary** of thirteen categories. It may also suggest exact local names for “best” or “famous” requests, but never a coordinate or query. OpenStreetMap supplies every position inside the locked viewport; unresolved suggestions disappear. Category results are ranked by notability (a Wikidata or Wikipedia link), then nearness to the subject, and spread apart so a category cannot stack six markers on one block.

What OSM cannot do is rank fame: it records what exists, not what is famous. That is why the New York brief asks for landmarks and subway stations rather than "iconic" ones — a promise the data can keep.

## Live OSM, no bundled dataset

MapTruth inspects the vector sources MapLibre already loaded via `querySourceFeatures` (falling back to `queryRenderedFeatures`) and normalizes roads, water, parks, and landmarks.

- Tile-derived IDs are `tile:<source-layer>:<source-id>:<geometry-hash>` and are never presented as canonical OSM IDs.
- Candidates outside the visible viewport are dropped, so the lock matches what you actually saw.
- When more features are in view than the cap allows, each class gets its own budget and features are ranked by importance (motorway before residential, named landmarks before unnamed). A single global cap used to starve roads behind parks.
- Locks record viewport, zoom, source revision, provenance, and geometry hashes. IndexedDB caches runtime locks by viewport and revision, keyed on a schema version so a stale entry can never be served.
- Map data © OpenStreetMap contributors under the ODbL, credited beside the source map and grounded result. A downloaded generated image is the model output alone, so its inspectable provenance remains on the page.

## API

Six Vercel Functions, all web-standard `POST` handlers:

- `POST /api/generate-route` — validates and runs exactly one `gpt-image-2` route.
- `POST /api/osm-extract` — canonical Overpass verification for a bounded bbox.
- `POST /api/plan-overlays` — reads the brief and returns categories from a fixed enum plus optional high-confidence place-name suggestions. No coordinates or map queries.
- `POST /api/osm-overlays` — turns those categories into real, named OpenStreetMap places inside the locked bbox.
- `POST /api/osm-named` — resolves suggested names inside the locked bbox and drops misses.
- `POST /api/geocode` — Nominatim lookup: forward (`{query}`), reverse (`{center}`), and viewport-bounded (`{query, within}`) so "DPR" resolves to the parliament building rather than a park of the same name elsewhere. English names, and a zoom clamped to a range the live lock accepts.

> Vercel treats a **default** export as the Node `(req, res)` signature and discards a returned `Response`. Named method exports (`export function POST`) are required for the Web handler shape — a default export makes every request hang until the function times out.

Set `OPENAI_API_KEY` server-side (never through a `VITE_` variable). On Vercel the endpoint can alternatively use the AI Gateway model ID `openai/gpt-image-2`.

```bash
npm install
npm run dev          # UI only
npm run dev:vercel   # UI + API (vercel dev)
```

## Verification

```bash
npm run lint && npm run typecheck && npm test && npm run build && npm run test:e2e
```

Unit tests cover tile classification, viewport clipping and budgeting, stable locks, both hash paths, prompt interpretation, pin resolution, route validation, marker-count handoff, prompt safety, and deployment headers. Playwright covers place focus, truth pins, the qualified provenance line, the two-screen studio, the About architecture route, the legacy `/demo` redirect, live locking, WebMCP registration, the agent walkthrough, agent-only navigation and verification, the full-screen viewer, and mobile layout.

GitHub Actions runs lint, type-check, unit tests, build, and desktop/mobile Chromium on pushes and PRs to `main`; failures upload traces and screenshots. Vercel's Git integration deploys passing `main` revisions.

MapTruth verifies provenance against the OSM-derived geometry available to the current runtime. It does not claim OpenStreetMap is perfectly complete or current.
