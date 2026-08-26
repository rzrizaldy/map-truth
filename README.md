# MapTruth

[![CI](https://github.com/rzrizaldy/map-truth/actions/workflows/ci.yml/badge.svg)](https://github.com/rzrizaldy/map-truth/actions/workflows/ci.yml)

MapTruth is a browser-native studio for making expressive map art without allowing the art process to redraw the geography. It combines a pinned OpenStreetMap-derived extract, human-drawn route or area geometry, deterministic SVG rendering, and five WebMCP tools.

The Central Jakarta–Senayan demo connects Monas, DPR/MPR, Gelora Bung Karno, major roads, parks, and canals. It uses no remote map tiles, live Overpass dependency, account system, or client-side secret.

## Three-way GPT Image demo

One action makes three real `openai/gpt-image-2` calls:

1. **Prompt only** — a complete map poster generated without geographic evidence.
2. **Map screenshot + GPT Image** — MapLibre is automatically captured and supplied as image-edit context.
3. **MapTruth + GPT Image** — GPT Image may generate only a non-geographic art layer. MapTruth then composites exact source and human geometry above it. The generated layer is explicitly forbidden from supplying maps, roads, routes, water, boundaries, labels, landmarks, icons, or coordinates.

Image generation runs in `api/generate-comparison.ts` through the Vercel AI SDK and AI Gateway model ID `openai/gpt-image-2`. There is deliberately no fake result or placeholder API response.

### Local AI setup

The static studio works with ordinary Vite:

```bash
npm install
npm run dev
```

The server-side image endpoint needs the Vercel development runtime:

```bash
cp .env.example .env.local
# Set OPENAI_API_KEY in .env.local for direct OpenAI GPT Image calls
vercel dev
```

When `OPENAI_API_KEY` is set, the API uses the OpenAI provider directly. Otherwise it uses Vercel AI Gateway (`openai/gpt-image-2`) with `AI_GATEWAY_API_KEY` or project OIDC on Vercel.

Vercel production: add `OPENAI_API_KEY` in the project Environment Variables dashboard (Production). Never expose an API key through a `VITE_` variable.

## WebMCP tools

The page feature-detects `document.modelContext` and registers:

- `get_map_context`
- `get_drawn_geometry`
- `render_grounded_poster`
- `verify_geography`
- `export_artwork`

All tool callbacks invoke the same schemas and command functions as the manual controls. Fabricated IDs return `unknown_feature_ids`; known IDs outside the active selection return `needs_user_action` with `destination_outside_selected_area`. The page remains fully usable when WebMCP is unavailable.

For local Chrome testing, enable `chrome://flags/#enable-webmcp-testing` and relaunch Chrome. Production discovery requires a valid WebMCP origin-trial token in `WEBMCP_ORIGIN_TRIAL_TOKEN`. The token is emitted as an `Origin-Trial` header by `vercel.ts` only when present.

## Data provenance

- Geographic extent: `106.785,-6.235,106.855,-6.155`
- Pinned source: Geofabrik Java extract dated 2026-08-25
- Source SHA-256: `d490da915938cdc8df6c0e13e067f63d4df1b58460313694563c4834f51b9dfb`
- Normalized output SHA-256: `e53cc2bbe927195eef447c36270c0a5122e7f98958314cdfea20831fe6162065`
- Feature count: 9,498
- Simplification: none

Committed artifacts live in `public/data/`:

- `demo-area.geojson`
- `feature-index.json`
- `data-attribution.json`

To reproduce them, install `osmium-tool` and run:

```bash
npm run data:prepare
```

The script downloads the pinned Geofabrik extract into an ignored `.cache/` directory, verifies its checksum, runs `osmium extract`, `osmium tags-filter`, and `osmium export`, then normalizes and deterministically sorts the result.

Map data © OpenStreetMap contributors, licensed under the [Open Data Commons Open Database License](https://www.openstreetmap.org/copyright). Attribution appears in the interface and every SVG/PNG export.

## Verification

```bash
npm test
npm run typecheck
npm run lint
npm run build
npx @vercel/config compile vercel.ts
```

The tests cover projection determinism, fabricated and out-of-selection ID rejection, preservation of human geometry, strict enum/text validation, SVG source IDs and geometry hashes, escaped unsafe text, and export attribution.

PNG exports are exactly 2400×3000. SVG exports use a 1200×1500 viewBox and embed local Latin subsets of Barlow Condensed, Source Sans 3, and IBM Plex Mono as data URLs.

## Deployment

- **GitHub:** [github.com/rzrizaldy/map-truth](https://github.com/rzrizaldy/map-truth)
- **Live site:** [map-truth.vercel.app](https://map-truth.vercel.app)

GitHub Actions runs lint, typecheck, unit tests, production build, and Playwright on every push and pull request to `main`.

Vercel project: `rzrizaldys-projects/map-truth`. Connect the GitHub repo in the Vercel dashboard if automatic deploys on push are not yet wired. For the GPT Image taste test in production, add **`OPENAI_API_KEY`** under Project → Settings → Environment Variables (Production). `vercel.ts` configures the Vite build, static security headers, same-origin WebMCP permissions, and the optional origin-trial header. Never expose an API key through a `VITE_` variable.

```bash
vercel login
vercel whoami
vercel link
vercel deploy
```

Deployment is not considered accepted until the live URL passes Browser and connected-Chrome checks and Chrome discovers and executes all five WebMCP tools.

## Scope statement

MapTruth verifies provenance against its pinned OSM-derived dataset. It does not claim that OpenStreetMap is perfectly complete or current.

