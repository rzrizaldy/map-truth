import { useEffect, useState } from 'react'
import { approvePendingComparison, cancelGeneration, runGenerationRoute } from '../ai/generation'
import { PosterSvg } from '../poster/PosterSvg'
import { appStore, useAppStore } from '../state/store'
import type { ComparisonRoute, GenerationRouteState } from '../types/maptruth'
import { lockLiveOsm } from '../webmcp/commands'

const routeCopy: Record<ComparisonRoute, { number: string; title: string; description: string; risk: string; riskClass: string }> = {
  promptOnly: { number: 'FIRST', title: 'Made up', description: 'The AI never saw a map. It invents the streets.', risk: 'Not a real place', riskClass: 'high' },
  screenshotGrounded: { number: 'SECOND', title: 'From a picture', description: 'The AI saw a screenshot and copied it by eye. Streets shift.', risk: 'Roughly right', riskClass: 'medium' },
  mapTruthGrounded: { number: 'THIRD', title: 'Grounded in the real map', description: 'The AI only made the artwork. The streets are the real ones.', risk: 'Real streets', riskClass: 'locked' },
}

function RouteProgress({ route, state }: { route: ComparisonRoute; state: GenerationRouteState }) {
  const [now, setNow] = useState(() => state.startedAt ?? Date.now())
  useEffect(() => {
    if (state.status !== 'generating') return
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [state.status])
  const elapsed = state.startedAt ? Math.round((now - state.startedAt) / 1000) : 0
  const label = state.status === 'queued' ? 'Waiting' : state.status === 'awaiting_approval' ? 'Needs your OK' : `Drawing · ${elapsed}s`
  return (
    <div className="route-progress" role="status">
      <span className="route-progress-rule" />
      <strong>{label}</strong>
      <small>{elapsed > 90 ? 'Detailed images can take up to two minutes.' : 'This is a real image being generated.'}</small>
      {state.status === 'generating' ? <button type="button" onClick={() => cancelGeneration(route)}>Stop waiting</button> : null}
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
        <strong>{state.status === 'cancelled' ? 'Stopped' : 'That one didn’t work'}</strong>
        <p>{state.error}</p>
        <button type="button" onClick={() => void runGenerationRoute(route)}>Try again</button>
      </div>
    )
  }
  if (route === 'mapTruthGrounded') {
    return locked ? <PosterSvg /> : (
      <div className="taste-empty">
        <strong>Pick a place first</strong>
        <span>This one needs a real map to stand on.</span>
        <button type="button" onClick={() => void lockLiveOsm()}>Use the current view</button>
      </div>
    )
  }
  return <div className="taste-empty">{route === 'promptOnly' ? <>Nothing to go on</> : <>Copied by eye</>}</div>
}

export function ComparisonGrid() {
  const ai = useAppStore((state) => state.ai)
  const locked = useAppStore((state) => Boolean(state.data.lock))
  const placeName = useAppStore((state) => state.place.name)
  const generated = Object.values(ai.routes).some((route) => route.status === 'ready')

  return (
    <section className={`step ${generated ? 'step--done' : 'step--waiting'}`} id="step-3">
      <div className="step-head">
        <span className="step-num">3</span>
        <h2>Spot the difference</h2>
        <p>Same prompt, three times. Only the third one knows what the streets really look like.</p>
      </div>

      {ai.pendingRoutes?.length ? (
        <div className="generation-approval" role="alert">
          <div>
            <span>ONE LAST CHECK</span>
            <strong>{ai.pendingRoutes.length} image{ai.pendingRoutes.length === 1 ? '' : 's'} ready to make</strong>
          </div>
          <p>An assistant set this up. Nothing has been generated or charged yet.</p>
          <button className="button button--primary" type="button" onClick={approvePendingComparison}>Make them</button>
          <button className="button" type="button" onClick={() => appStore.setState((state) => ({ ai: { ...state.ai, pendingRoutes: undefined } }))}>Cancel</button>
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
              <p>{route === 'mapTruthGrounded' && locked ? `Real streets of ${placeName}, styled by AI.` : copy.description}</p>
              <div className="taste-visual"><ResultVisual route={route} state={state} locked={locked} /></div>
              <div className="card-status-row">
                <span className={`risk-tag risk-tag--${copy.riskClass}`}>{copy.risk}</span>
                {state.durationMs ? <span className="route-duration">{(state.durationMs / 1000).toFixed(0)}s</span> : null}
              </div>
              {route === 'mapTruthGrounded' && locked && state.status === 'idle' ? (
                <button className="route-action" type="button" onClick={() => void runGenerationRoute(route)}>Make this one</button>
              ) : null}
            </article>
          )
        })}
      </div>
      <p className="taste-footnote">Map data © OpenStreetMap contributors</p>
    </section>
  )
}
