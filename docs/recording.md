# Recording the demo

Two minutes, one scenario, three takes with a cut between each. The cuts are
deliberate: image generation takes about a minute and nobody should watch that.

Everything before generation is now instant and deterministic — the examples
replay a snapshot captured from the real pipeline (`npm run capture:preload`),
so no take can be spoiled by Overpass or the model having a bad minute.

## The scenario: New York landmarks & subway

Chosen over the other two because it contains the one moment that makes the
whole argument visible in ten seconds:

> The model suggested **8** places. **6** are here. It named the Statue of
> Liberty, and OpenStreetMap says that is not in this view — so it was not
> placed.

That is the product refusing to draw something the model was confident about.
A poster with a Statue of Liberty pin in Lower Manhattan is exactly the kind of
error that survives review, because it looks right.

Mention Pittsburgh in passing if the timing allows — three rivers meeting at a
point, and every dock a real POGOH station named the way the street sign names
it — but do not run it. One scenario, told properly, beats two rushed.

## Shot list

**Take 1 — the ask (0:00–0:50)**

| At | On screen | Say |
|---|---|---|
| 0:00 | Landing page, map already loaded | "This is a live OpenStreetMap view. Nothing on it is generated." |
| 0:08 | Click **New York landmarks & subway** | "I ask for landmarks and the nearest subway stations." |
| 0:15 | Map flies to Lower Manhattan, markers appear | "The model chose what kinds of place to mark. It never chose where they are." |
| 0:28 | Point at **Landmark · 6 / Transit · 6** | "OpenStreetMap supplied every coordinate on this map." |
| 0:36 | Point at **6 of 8 verified** | "It suggested eight named places. Six exist in this view. It named the Statue of Liberty — that is not here, so it was not placed." |
| 0:48 | Click **Make both maps** | "Same brief, twice. Once with this map, once without." |

**Cut.** Stop recording. Wait for both images.

**Take 2 — the comparison (0:50–1:30)**

| At | On screen | Say |
|---|---|---|
| 0:50 | Both results side by side | "Left: prompt only. Right: grounded on the map you just watched get built." |
| 1:00 | Click the left image to open it | "This one is confident and wrong. The streets are invented and so is the legend." |
| 1:12 | Close, open the right image | "This one is the real street layout, with the real stations, at their real coordinates." |
| 1:24 | Close the lightbox | "Neither is a screenshot. Both are generated. Only one is checkable." |

**Cut.**

**Take 3 — WebMCP (1:30–2:00)**

| At | On screen | Say |
|---|---|---|
| 1:30 | Click the agent badge, top right | "The page registers ten WebMCP tools." |
| 1:38 | Scroll the tool list | "An agent in the browser can move the map, lock a viewport, mark it from OpenStreetMap, and verify the geometry hash." |
| 1:48 | Point at a verify/lock entry in the activity log | "Generation is behind a cost gate, so the agent has to ask. The page holds the rules; the agent operates them." |
| 1:55 | — | "The model names. OpenStreetMap locates. The person decides." |

## Two ways to drive it

**By hand.** Follow the table. The examples are instant now, so the only wait is
generation, which is where the cut is.

**On a clock.** `npm run demo:drive` opens Chrome with WebMCP enabled and
performs Take 1 and Take 2 on a fixed schedule, printing each cue as it starts.
Start the recorder, press Enter, narrate. Add `-- pittsburgh` for that run
instead.

## Before you upload

- Record at 1440×900 or wider. The comparison is two images side by side and
  goes unreadable below that.
- Use production (`https://map-truth.vercel.app`), not localhost. Judges check
  that the live URL is the thing in the video.
- Watch it back with the audio on. Under three minutes, and it has to say what
  was built and how WebMCP was used — both are on the checklist.

## Prompt for a recording agent

Paste this to whichever agent has screen-recording permission. It records
silent video only — narration is added afterwards over the top, so the agent
must hold each beat long enough to talk over.

---

Record a screen capture of `https://map-truth.vercel.app` in Chrome, maximised,
at 1440×900 or wider. No audio — narration is added later, so hold every beat
long enough to speak the line under it. Produce **three separate clips**; do not
try to record one continuous take.

**Clip 1 — "ask" (about 50 seconds)**

1. Open the site. Wait until the map has finished drawing before you start
   recording. Hold 6s.
2. Click the example button **New York landmarks & subway**. Do not type
   anything.
3. The map flies to Lower Manhattan and coloured markers appear. Hold 12s.
4. Move the cursor slowly over the readback panel on the left, resting on
   **Landmark · 6**, then **Transit · 6**, then **6 of 8 verified**, then the
   list of six place names below it. Roughly 4s on each. This panel is the
   point of the video — do not rush it.
5. Click **Make both maps →**. Stop recording as the page changes.

**Clip 2 — "compare" (about 40 seconds)**

Wait until *both* images have finished generating — up to 90 seconds. Do not
record the waiting.

1. Start recording with both results on screen. Hold 8s.
2. Click the **left** image to open it full screen. Hold 10s. Close it.
3. Click the **right** image to open it full screen. Hold 10s. Close it.
4. Hold 5s on the two side by side. Stop recording.

**Clip 3 — "webmcp" (about 30 seconds)**

1. Click the agent badge in the top-right of the header. A drawer opens listing
   the WebMCP tools. Hold 6s.
2. Scroll the tool list slowly from top to bottom so all ten names are legible.
   Take 10s over it.
3. Scroll to the activity log below and rest on the entries naming
   `lock_live_osm` and `mark_from_osm`. Hold 8s.
4. Stop recording.

**Rules**

- Move the cursor slowly and deliberately. Fast pointer movement is unreadable
  at video bitrates and looks careless.
- Never type into the brief box. The example buttons replay a saved snapshot
  and are instant; typing triggers live lookups that can take 15 seconds and
  will stall the take.
- If a click does not register, wait 2 seconds and click once more. Do not
  click repeatedly.
- If generation fails or an image does not appear, reload and start Clip 2
  again rather than recording an error state.
- Report the three file paths and their durations when done.
