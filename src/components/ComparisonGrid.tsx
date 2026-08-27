import { useEffect, useState } from 'react'
import { approvePendingComparison, cancelGeneration, generateComparisonManually, runGenerationRoute } from '../ai/generation'
import { PosterSvg } from '../poster/PosterSvg'
import { appStore, useAppStore } from '../state/store'
import type { ComparisonRoute, GenerationRouteState } from '../types/maptruth'
import { lockLiveOsm } from '../webmcp/commands'

const routeCopy: Record<ComparisonRoute, { number: string; title: string; description: string; risk: string; riskClass: string }> = {
  promptOnly: { number: 'LEVEL 1', title: 'Prompt only', description: 'No map evidence at all. The model invents the city.', risk: 'Unverified', riskClass: 'high' },
  screenshotGrounded: { number: 'LEVEL 2', title: 'Screenshot', description: 'The live viewport is passed as an image. Topology can still drift.', risk: 'Visually guided', riskClass: 'medium' },
  mapTruthGrounded: { number: 'LEVEL 3', title: 'WebMCP map truth', description: 'GPT supplies art only; exact OSM paths stay deterministic.', risk: 'Geometry-locked', riskClass: 'locked' },
}

function RouteProgress({ route, state }: { route: ComparisonRoute; state: GenerationRouteState }) {
  const [now, setNow] = useState(() => state.startedAt ?? Date.now())
  useEffect(() => {
    if (state.status !== 'generating') return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [state.status])
  const elapsed = state.startedAt ? Math.round((now - state.startedAt) / 1000) : 0
  const label = state.status === 'queued' ? 'Queued' : state.status === 'awaiting_approval' ? 'Awaiting approval' : `Generating · ${elapsed}s`
  return (
    <div className="route-progress" role="status">
      <span className="route-progress-rule" />
      <strong>{label}</strong>
      <small>{elapsed > 90 ? 'Complex GPT Image requests can take up to two minutes.' : 'A real gpt-image-2 request is running.'}</small>
      {state.status === 'generating' ? <button type="button" onClick={() => cancelGeneration(route)}>Cancel locally</button> : null}
    </div>
  )
}

function ResultVisual({ route, state, locked }: { route: ComparisonRoute; state: GenerationRouteState; locked: boolean }) {
  if (state.status === 'generating' || state.status === 'queued' || state.status === 'awaiting_approval') return <RouteProgress key={state.status} route={route} state={state} />
  if (state.status === 'ready' && state.imageDataUrl) {
    return route === 'mapTruthGrounded'
      ? <PosterSvg backgroundImage={state.imageDataUrl} />
      : <img src={state.imageDataUrl} alt={`${routeCopy[route].title} GPT Image result`} />
  }
  if (state.status === 'error' || state.status === 'cancelled') {
    return (
      <div className="route-error">
        <strong>{state.status === 'cancelled' ? 'Cancelled in this browser' : 'This route failed'}</strong>
        <p>{state.error}</p>
        <button type="button" onClick={() => void runGenerationRoute(route)}>Retry this route</button>
      </div>
    )
  }
  if (route === 'mapTruthGrounded') {
    return locked ? <PosterSvg /> : (
      <div className="taste-empty">
        <strong>Lock a view first</strong>
        <span>Route 3 unlocks straight from the loaded vector tiles.</span>
        <button type="button" onClick={() => void lockLiveOsm()}>Lock this view</button>
      </div>
    )
  }
  return <div className="taste-empty">{route === 'promptOnly' ? <>No map evidence<br />Maximum invention</> : <>Live viewport as pixels<br />Geometry may drift</>}</div>
}

export function ComparisonGrid() {
  const ai = useAppStore((state) => state.ai)
  const locked = useAppStore((state) => Boolean(state.data.lock))
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const anyRunning = Object.values(ai.routes).some((route) => route.status === 'generating' || route.status === 'queued')
  const generated = Object.values(ai.routes).some((route) => route.status === 'ready')

  return (
    <>
      <section className={`step ${mapReady ? '' : 'step--waiting'}`} id="step-2">
        <div className="step-head">
          <span className="step-num">2</span>
          <h2>Write one prompt</h2>
          <p>The same art brief goes to all three routes. Nothing else differs.</p>
        </div>
        <div className="prompt-block">
          <label htmlFor="ai-prompt">Art brief sent to GPT Image 2</label>
          <textarea
            id="ai-prompt"
            value={ai.prompt}
            maxLength={1200}
            onChange={(event) => appStore.setState((current) => ({ ai: { ...current.ai, prompt: event.target.value } }))}
          />
          <div className="prompt-actions">
            <button className="button button--primary" type="button" onClick={() => void generateComparisonManually()} disabled={!mapReady || anyRunning}>
              {anyRunning ? 'Generating…' : locked ? 'Generate all 3' : 'Generate routes 1 + 2'}
            </button>
            <small>{locked ? 'Route 3 uses your live OSM lock.' : 'Lock a view in step 1 to unlock route 3.'}</small>
          </div>
        </div>
      </section>

      <section className={`step ${generated ? 'step--done' : 'step--waiting'}`} id="step-3">
        <div className="step-head">
          <span className="step-num">3</span>
          <h2>Compare the evidence</h2>
          <p>Same prompt, three levels of grounding. Watch invention collapse into geometry.</p>
        </div>

        {ai.pendingRoutes?.length ? (
          <div className="generation-approval" role="alert">
            <div>
              <span>WEBMCP COST GATE</span>
              <strong>{ai.pendingRoutes.length} real GPT Image request{ai.pendingRoutes.length === 1 ? '' : 's'} staged</strong>
            </div>
            <p>The agent prepared these routes. Nothing has been billed yet.</p>
            <button className="button button--primary" type="button" onClick={approvePendingComparison}>Approve generation</button>
            <button className="button" type="button" onClick={() => appStore.setState((state) => ({ ai: { ...state.ai, pendingRoutes: undefined } }))}>Dismiss</button>
          </div>
        ) : null}

        <div className="taste-grid">
          {(Object.keys(routeCopy) as ComparisonRoute[]).map((route) => {
            const copy = routeCopy[route]
            const state = ai.routes[route]
            return (
              <article className={`taste-card ${route === 'mapTruthGrounded' ? 'taste-card--truth' : ''}`} key={route}>
                <div className="taste-number">{copy.number}</div>
                <h3>{copy.title}</h3>
                <p>{copy.description}</p>
                <div className="taste-visual"><ResultVisual route={route} state={state} locked={locked} /></div>
                {route === 'mapTruthGrounded' ? (
                  <div className="preview-ladder" aria-label="MapTruth preview stages">
                    <span className="done">Basemap</span>
                    <span className={locked ? 'done' : ''}>OSM lock</span>
                    <span className={state.status === 'ready' ? 'done' : ''}>Art layer</span>
                    <span className={state.status === 'ready' ? 'done' : ''}>Truth seam</span>
                  </div>
                ) : null}
                <div className="card-status-row">
                  <span className={`risk-tag risk-tag--${copy.riskClass}`}>{copy.risk}</span>
                  {state.durationMs ? <span className="route-duration">{(state.durationMs / 1000).toFixed(1)}s</span> : null}
                </div>
                {route === 'mapTruthGrounded' && locked && state.status === 'idle' ? (
                  <button className="route-action" type="button" onClick={() => void runGenerationRoute(route)}>Generate route 3</button>
                ) : null}
              </article>
            )
          })}
        </div>
        <p className="taste-footnote">Map data © OpenStreetMap contributors · Route 3 overlays source IDs and geometry hashes after generation.</p>
      </section>
    </>
  )
}
