# Notes — finishing the WebMCP setup

Handoff for whoever picks this up next. Everything here was verified against the
deployed site on 2026-08-28; re-check anything that looks stale before trusting it.

## Where WebMCP stands

**Working and verified.** In Chrome 151 with the WebMCP feature enabled, the live
site exposes `document.modelContext`, registers all ten tools, and
`getTools()` returns them with schemas and annotations. Reproduce in one command:

```bash
npm run verify:webmcp
```

It drives your installed Chrome against **production** — nothing is mocked. Expected:

```
ok    document.modelContext is exposed by the browser
ok    all 10 tools registered and discoverable
ok    every tool publishes an input schema
ok    every tool describes itself
ok    only the two inspect tools claim readOnlyHint
ok    the page reports "Agent mode · 10 tools"
```

**The one open item.** A visitor on *stock* Chrome — no flag — still sees
**Manual mode**, because the page never receives an origin-trial token. That is
the only thing between the current state and agent mode working for everyone.

## The task: ship an origin-trial token

### 1. Register the trial

Chrome origin trials are registered at <https://developer.chrome.com/origintrials>.
The WebMCP trial was confirmed **Available** on 2026-08-28 for Chrome 149–156,
with an end date of 2026-11-16. Sign in with a Google account and register the
origin:

```
https://map-truth.vercel.app
```

The direct registration page is
<https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241>.
Tokens are origin-scoped and expire, so record the expiry somewhere visible.

This token is polish for visitors using stock Chrome, not a prerequisite for
challenge judging. The official challenge resources say to use ChatGPT's
in-app Browser (WebMCP is available directly) or Chrome 149+ with
`chrome://flags/#enable-webmcp-testing` enabled.

### 2. Set it as a Vercel **build** environment variable

The wiring already exists. `vercel.ts:3` reads the variable and `vercel.ts:25`
emits the header only when it is set:

```ts
const originTrialToken = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN
// …
...(originTrialToken
  ? [routes.header('/(.*)', [{ key: 'Origin-Trial', value: originTrialToken }])]
  : []),
```

It is read while the config compiles, i.e. **at build time** — a runtime-only
variable will not work, and setting it does nothing until the next deploy.

```bash
vercel env add WEBMCP_ORIGIN_TRIAL_TOKEN production
# paste the token, then redeploy:
git commit --allow-empty -m "Deploy with WebMCP origin trial" && git push
```

Add it to `preview` too if preview URLs should also run agent mode — but the
token is origin-scoped, so a token for `map-truth.vercel.app` will **not** cover
`map-truth-<hash>-….vercel.app`. Either register the preview origin separately or
accept Manual mode on previews.

### 3. Verify

```bash
# the header is present at all
curl -sSI https://map-truth.vercel.app/ | grep -i origin-trial

# and the page actually reports agent mode
npm run verify:webmcp
```

Then open the site in **plain** Chrome — no flags, no `--enable-features` — and
confirm the badge reads `Agent mode · 10 tools` rather than `Manual mode`.
That last check is the whole point; the others can pass while the token is
rejected for a mismatched origin or an expired date.

If the header is present but Chrome ignores it, open DevTools → Application →
Frames → the top frame, which lists origin trial tokens and why one was refused.

### Fallback

A `<meta http-equiv="origin-trial" content="TOKEN">` in `index.html` works too.
Prefer the header: it is already wired, it is covered by a test, and it keeps the
token out of the HTML source.

## Guard rails

- `tests/config/vercel-config.test.ts` asserts the `Origin-Trial` header appears
  **exactly when** the variable is set, and not otherwise. Keep that passing.
- `Permissions-Policy: tools=(self)` is already emitted (`vercel.ts:11`) and is
  required — without it the tools are registered but not exposed.
- Do not weaken the manual path. With no WebMCP the page must stay fully usable
  and honestly report Manual mode. `src/webmcp/register.ts:28` is that branch.

## Things that cost time, so you don't rediscover them

- **The Chrome flag is `chrome://flags/#enable-webmcp-testing`**, and the
  command-line equivalent is `--enable-features=WebMCP`. I found that by probing
  candidates; `WebMachineLearningModelContext` and several other plausible names
  do **not** work.
- **Playwright's bundled Chromium has no WebMCP.** `verify:webmcp` launches the
  real installed Chrome via `channel: 'chrome'`. This is why it is not in CI —
  GitHub runners have no WebMCP-capable browser, and a check that silently
  degrades to a stub is worse than no check.
- **Execution is not observable from page scripts.** The spec's `RegisteredTool`
  exposes name/description/schema but no `execute`; only the browser's agent side
  invokes it. So `verify:webmcp` proves registration and discovery. Execution is
  covered by the on-page walkthrough and by Playwright, which call the same
  functions. Do not claim an agent was observed calling them unless one was.
- **Vercel API routes must export named methods** (`export function POST`). A
  default export is read as Node's `(req, res)` signature, the returned
  `Response` is discarded, and every request hangs until timeout — it looks like
  a slow upstream, not an error. This already bit the project once.

## Once the token is live

Update the claims that currently hedge:

- `README.md` → "Enabling agent mode" says stock Chrome reports Manual mode by
  design. That stops being true.
- `CONTINUE.md` → "WebMCP status" open item.
- `src/components/AgentWalkthrough.tsx` → the copy explaining that the browser
  has no WebMCP already switches on `webmcpAvailable`, so it needs no change.

Do not update those before the plain-Chrome check passes.
