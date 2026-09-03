# Final demo record

The canonical public demo is <https://youtu.be/cMuCQtug00M>. It is 1 minute 38
seconds, public, in English, and includes spoken audio explaining what was built
and how WebMCP is used.

## Scenario

The video uses this New Orleans brief:

> Wide-area city resilience overview. Mark medical facilities, public parks,
> and transit stops across New Orleans.

The camera stays far enough out to show the large-scale geography that a model
is likely to distort: Lake Pontchartrain north of the city and the crescent of
the Mississippi River through it. The prompt-only result looks plausible but
is unsourced. The grounded result begins from a locked OpenStreetMap view and
marks resolved places from that view.

## Edit structure

- **0:00–0:42 — working app.** Show the live source map, New Orleans brief,
  evidence read-back, and the action that stages the comparison.
- **0:42–1:12 — comparison.** Show the pre-generated prompt-only and grounded
  results with no generation wait in the recording.
- **1:12–1:38 — WebMCP.** Show `Agent mode · 10 tools`, the registered tool
  surface, and explain that the agent can operate the map while generation
  remains behind a human approval gate.

The final comparison was generated before recording so the submitted video has
no loading pause. That is an edit for pacing, not a separate product path: the
live app exposes the same New Orleans state and generation flow, while the repo
contains the screenshot used to document the result.

## Claims shown in the video

- The source view is OpenStreetMap-derived and visibly attributed.
- The prompt-only image did not receive the source map.
- The grounded image received the locked source view.
- The page registers ten WebMCP tools.
- The agent-facing workflow cannot approve paid generation for the person.

MapTruth verifies the evidence passed into generation; it does not claim
pixel-perfect cartographic accuracy in the model's redraw or perfect
completeness of OpenStreetMap.
