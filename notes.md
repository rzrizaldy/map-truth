# Notes — WebMCP production setup

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

**Stock Chrome is working too.** The origin trial is registered for
`https://map-truth.vercel.app`, and its token is installed as the sensitive
Vercel Production build variable `WEBMCP_ORIGIN_TRIAL_TOKEN`. Deployment
`776cc3a` emits the header; a fresh ordinary Chrome tab, with no test launcher,
reported `Agent mode · 10 tools` on 2026-08-28.

## Origin-trial operations

### 1. Register the trial

Chrome origin trials are registered at <https://developer.chrome.com/origintrials>.
The WebMCP trial was confirmed **Available** on 2026-08-28 for Chrome 149–156,
with an end date of 2026-11-16. The registered origin is:

```
https://map-truth.vercel.app
```

Manage or renew it from the direct registration page:
<https://developer.chrome.com/origintrials/#/register_trial/4163014905550602241>.
Tokens are origin-scoped and expire, so record the expiry somewhere visible.

This token is polish for visitors using stock Chrome, not a prerequisite for
challenge judging. The official challenge resources say to use ChatGPT's
in-app Browser (WebMCP is available directly) or Chrome 149+ with
`chrome://flags/#enable-webmcp-testing` enabled.

### 2. Vercel **build** environment variable

The variable is configured for Production. `vercel.ts:3` reads it and
`vercel.ts:25` emits the header only when it is set:

```ts
const originTrialToken = process.env.WEBMCP_ORIGIN_TRIAL_TOKEN
// …
...(originTrialToken
  ? [routes.header('/(.*)', [{ key: 'Origin-Trial', value: originTrialToken }])]
  : []),
```

It is read while the config compiles, i.e. **at build time** — a runtime-only
variable will not work, and setting it does nothing until the next deploy.

After renewing the token, replace the Production value and redeploy. It is read
while the config compiles, so changing the value without a new build has no
effect.

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

## Final production receipt

- Vercel deployment `776cc3a` reached Ready and owns the production aliases.
- `Origin-Trial` is present; `Permissions-Policy: tools=(self)` remains present.
- Plain Chrome reports `Agent mode · 10 tools` and the corrected six-call copy.
- ChatGPT's in-app Browser discovers exactly ten tools with no console warnings.
- The registration expires on 2026-11-16 and must be renewed or removed then.
