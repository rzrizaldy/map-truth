# Submission kit

Working notes for the Devpost entry. Not part of the app.

---

## Video script (~2 min 20 s spoken, ~350 words)

Read at a normal pace. Timings are cues for what to show, not hard cuts.

### 0:00 — The problem, on screen (~20 s)

> Ask any image model for a map of a real place and it will give you one.
> It will look convincing. The streets will be in the wrong places, the
> landmarks will be somewhere they have never been, and nothing on it will
> tell you which parts are real.
>
> That is fine for a wallpaper. It is not fine for a protest safety map, an
> evacuation route, or anything somebody might actually follow.

*Show: the left-hand result — a beautiful invented Bandung poster with a
"TOP 10 COFFEESHOP" list. Let it look good. That is the point.*

### 0:20 — Why WebMCP is the answer (~35 s)

> MapTruth is a page that already holds the truth. A live OpenStreetMap
> view, every shape hashed to its source.
>
> WebMCP lets an assistant reach into that page and use it — not by reading
> a screenshot, not by scraping the DOM, but by calling the same ten
> functions the buttons call. So the page keeps its own rules. The agent
> can move the map, lock it, and decide what to mark. It cannot invent a
> coordinate, because it is never given one to invent.
>
> That is the difference between an agent that describes a map and an agent
> that works inside one.

*Show: the header badge reading "Agent mode · 10 tools", then the drawer
listing them.*

### 0:55 — The flow (~45 s)

> You pick a real place. OpenStreetMap decides where it is.
>
> You say what the map needs — here, the best coffee shops in Bandung.
> The model does the part only it can do: it knows which places people
> actually mean. It returns names, and nothing else. No coordinates.
>
> Every name is then looked up in OpenStreetMap. The ones that exist get
> pinned at their real position. The ones that do not are dropped, and the
> page says so out loud: two of four verified. That number is the product.

*Show: search "Bandung", type the brief, the read-back filling in, purple
numbered pins appearing on the map.*

### 1:40 — The comparison (~30 s)

> Same brief, twice. One model never saw a map. The other was handed this
> one.
>
> The invented version is prettier. It is also fiction. The grounded one is
> drawn on streets you can check — and there is a link under it to do
> exactly that, on OpenStreetMap.

*Show: the two results side by side, then click "Check on OpenStreetMap".*

### 2:10 — Close (~15 s)

> A model can style evidence. It should not be the one supplying it.
> That is what WebMCP made possible here: the human chooses, the model
> suggests, and the map is the thing that decides.

*Show: the live URL.*

---

## Devpost description

### What it does

MapTruth generates map artwork that is grounded in real geography instead of
imagined geography. You pick a real place, describe the map you need, and it
produces two results side by side: one from a model that never saw a map, and
one drawn on a live, hashed OpenStreetMap view of that exact place.

### Why WebMCP, specifically

The problem with letting an assistant make a map is not that models are bad at
drawing. It is that a model asked for a coordinate will produce one, and a
wrong coordinate is indistinguishable from a right one once it is rendered.

WebMCP fixes the shape of the problem rather than the model's behaviour. The
page owns a live OpenStreetMap view and every invariant that matters: features
are hashed to their source, the lock belongs to a place that was explicitly
chosen, and nothing unverified can be drawn. Exposing ten tools through
`document.modelContext` lets an assistant operate that page directly —
`focus_place`, `lock_live_osm`, `mark_from_osm`, `verify_geography` — instead
of being handed a screenshot to interpret or a DOM to scrape.

The division of labour that falls out of this is the interesting part:

- **The model names.** It knows which cafes in Bandung people mean. It returns
  names only, and is structurally incapable of returning a position.
- **OpenStreetMap locates.** Every name is looked up in the locked viewport.
  Whatever cannot be found is dropped, and the interface reports the drop —
  "2 of 4 verified" — rather than quietly placing it approximately.
- **The person decides.** The place is chosen explicitly, and every costed
  generation stops at a visible approval gate.

An agent driving this page cannot move the city, cannot invent a landmark, and
cannot spend money without being told to. Those are properties of the page, not
promises about the model.

### What people and agents can do together now

A person picks a place and says what the map is for. An assistant works out
what that kind of map needs, marks the real instances from OpenStreetMap, and
leaves a visible receipt for every action it took. When the data does not
support the request, both of them find out — which is the outcome a map is
supposed to give you.

### Honest limits

OpenStreetMap records what exists, not what is famous, and its coverage of
small businesses varies by city. A brief asking for "the best" of something in
a thinly-mapped area will verify few of its suggestions. That is visible in the
interface on purpose: an unverifiable place is not placed.

### Built during the submission period

Repository created 26 August 2026, first commit the same day. All work is in
dated commits from 26–30 August.
