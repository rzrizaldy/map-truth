# Devpost submission kit

Canonical copy for the WebMCP Challenge submission. Keep the live app, public
repository, video, and this document unchanged after the submission deadline.

## Links

- Live project: <https://map-truth.vercel.app>
- Public source: <https://github.com/rzrizaldy/map-truth>
- Public demo video: <https://youtu.be/cMuCQtug00M> (1:38)
- License: [MIT](../LICENSE)

## Project overview

**Project name:** MapTruth

**Elevator pitch (148/200 characters):**

> MapTruth lets people and browser agents turn a real OpenStreetMap view into
> AI-generated map artwork—without letting the model invent the geography.

## Project description

### What it does

Ask an image model for a map of a real place and it can draw something
beautiful, confident, and geographically false. MapTruth changes the input to
that process. A person chooses a place and writes a brief; MapTruth locks a
live OpenStreetMap view, resolves requested features against OpenStreetMap,
and generates two images side by side: one from the prompt alone and one
grounded in the sourced map.

The comparison makes the failure mode visible. In the New Orleans demo, the
ungrounded result invents a plausible city. The grounded result preserves the
large-scale relationship among Lake Pontchartrain, the city, and the
Mississippi River, and marks only places resolved within the locked view.

### Why WebMCP

The page—not the model—owns the map and its invariants. Through
`document.modelContext.registerTool`, MapTruth exposes ten typed browser tools
for focusing a place, navigating, inspecting and locking the live map, marking
features from OpenStreetMap, verifying geography, and staging a comparison.
An agent calls those tools directly instead of interpreting a screenshot or
scraping UI text.

That changes what an agent is allowed to invent. The model may decide what
kinds of places a brief needs, but it never supplies their coordinates.
OpenStreetMap locates them. Anything that cannot be resolved inside the locked
view is dropped and reported rather than approximately placed.

The app's visible six-step assistant walkthrough uses WebMCP's native
`executeTool()` path when it is available, so judges can watch the agent call
the same registered tools that another browser agent discovers. It leaves a
receipt for each action and stops at the human approval gate before any paid
image generation.

### A better user experience

Without WebMCP, an assistant would have to guess from pixels or automate
fragile controls. Here it receives named, typed capabilities and compact
structured results. A person can see the same state, source attribution,
verification counts, geometry hashes, and approval boundary the agent sees.
The interface also has a manual fallback, so the product remains usable in a
browser that does not yet expose WebMCP.

### What people and agents do together

- The person chooses the real place, states the purpose, and approves cost.
- The agent turns that intent into a sequence of explicit browser-tool calls.
- OpenStreetMap supplies locations and geometry.
- MapTruth rejects unsupported places, verifies the locked evidence, and
  records tool receipts.
- The image model styles the evidence; it does not supply the evidence.

### How it was built

MapTruth is a React and TypeScript application built with Vite. MapLibre GL JS
renders the live map. Nominatim resolves the requested city; Overpass provides
nearby OpenStreetMap features. The browser integration registers ten WebMCP
tools with JSON schemas, annotations, bounded outputs, and untrusted-content
hints. Vercel Functions proxy the external services and image generation.

Examples use checked-in snapshots captured from the same live pipeline so a
demo does not stall on a public service. A separate verification script launches
installed Chrome with WebMCP enabled, discovers all ten tools through
`document.modelContext.getTools()`, and executes `inspect_map_context` through
the browser's own `document.modelContext.executeTool()`.

### Challenges

The difficult part was not drawing a map. It was defining a trust boundary an
agent could not casually cross: the model can name candidates but cannot set a
coordinate; geometry must belong to the current locked place; stale locks must
be rejected; and paid generation must require visible human approval. Public
geocoding and Overpass services also vary in latency, so the experience needed
deterministic examples without pretending they were a separate data path.

### Accomplishments

- Ten discoverable WebMCP tools operate a real map workflow rather than a toy
  counter or hidden demo route.
- Native discovery and execution are tested in installed Chrome, with no
  mocked model context in the production verifier.
- Every generated comparison has a visible source line and OpenStreetMap
  inspection link.
- Agent activity is legible to the person and stops before cost.
- The same app remains usable manually when WebMCP is unavailable.

### What I learned

Reliable agent UX comes from moving important guarantees out of prompts and
into the page's tool contract. Structured tools make collaboration clearer,
but the strongest result comes from deliberately limiting each participant:
the model names, OpenStreetMap locates, the page verifies, and the person
decides.

### What's next

Next I would add saved, shareable evidence bundles; compare OpenStreetMap
changes over time; and support more source layers while keeping the same
provenance contract. The most useful extension is not more autonomous drawing,
but better ways to inspect why a place was accepted or rejected.

### Honest limits

MapTruth verifies that generation received geometry derived from the current
OpenStreetMap view. It does not claim that every generated pixel is
cartographically exact or that OpenStreetMap is perfectly complete or current.
The prompt-only image is deliberately untrusted. Example snapshots are marked
as snapshots; typing a new city exercises the live service path.

### Built during the challenge

The repository was created on August 26, 2026 and its first commit is dated the
same day, after the challenge submission period opened on August 25. The full
implementation history is visible in the public commit log.

## Testing instructions

No login, credentials, browser extension, or paid action is required.

1. Open <https://map-truth.vercel.app> in ChatGPT's in-app browser, or in
   Chrome 149+ with `chrome://flags/#enable-webmcp-testing` enabled and Chrome
   relaunched.
2. Confirm the header reads **Agent mode · 10 tools**. Open that badge to see
   all ten registered tools.
3. Select a preloaded example, such as **New York landmarks & subway**. The
   example replays a checked-in OpenStreetMap snapshot from the live pipeline,
   so it loads immediately and clearly labels itself as a snapshot.
4. In the agent panel, click **Watch an assistant do it**. The walkthrough
   calls six registered tools through native `executeTool()` when WebMCP is
   available, shows each result, and stops at the generation approval gate.
5. To exercise live services, type a city and brief instead. Nominatim,
   planning, and Overpass resolution may take several seconds.
6. For a terminal-level native check, clone the repository, run `npm install`,
   then `npm run verify:webmcp`. It launches installed Chrome, discovers all ten
   tools, executes the read-only `inspect_map_context` tool, and verifies the
   on-page agent-mode badge.

The generated-image button is not needed to judge WebMCP execution. If used,
it presents estimated cost and requires explicit human approval first.

## Final video record

The public 1:38 video uses one New Orleans example and has audio explaining the
problem, the working comparison, and how WebMCP is used.

- 0:00 — live app and the problem
- 0:42 — prompt-only versus grounded New Orleans comparison
- 1:12 — registered WebMCP tools and human approval boundary
