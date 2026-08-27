# MapTruth

[![CI](https://github.com/rzrizaldy/map-truth/actions/workflows/ci.yml/badge.svg)](https://github.com/rzrizaldy/map-truth/actions/workflows/ci.yml)

**Ask an AI for a map of somewhere real, and it invents the streets. MapTruth hands it the real one instead.**

### → [map-truth.vercel.app](https://map-truth.vercel.app)

Write a prompt that names a place. An agent finds it in OpenStreetMap, moves the map there, locks the viewport, pins whatever else the prompt named at its true coordinates, and hands the image model that exact, attributed map. You get the same prompt twice — with and without it.

| | What the model was given | Result |
|---|---|---|
| **Without a map** | The prompt alone | A convincing city that does not exist |
| **Grounded by WebMCP** | The prompt + a real, located, pinned OpenStreetMap view | The actual place |

![Both levels, generated from the same prompt](public/example/comparison.jpg)

### Try it in 60 seconds

1. Open the site. Both cards already show a finished run — no waiting.
2. Edit the prompt to name any city, or something in one (`Peta demo DPR Jakarta`). A **Go to _that_** button appears; click it. The map flies there and locks.
3. Anything else the prompt names is looked up in OpenStreetMap, bounded to that viewport, and **pinned on the live map** — so the pin is inside the screenshot the model receives.
4. Hit **Run the agent on _that place_** to watch the WebMCP tool calls execute live, ending at a human approval gate.
5. Hit **Make 2 images** for your own run (~50s each, real `gpt-image-2` calls). Click any result to open it full screen.

### Why this is a WebMCP project

WebMCP lets a page hand an agent real, typed tools instead of hoping it clicks the right pixels. MapTruth exposes nine. The interesting one is `focus_place`: an assistant grounds an image in "Jakarta", or in the DPR building, by *naming* it — and the page answers with a located, hashed, attributed map it can verify afterwards.

