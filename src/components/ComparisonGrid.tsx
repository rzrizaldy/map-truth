import { useEffect, useState } from 'react'
import { Lightbox } from './Lightbox'
import { exportGroundedArtwork } from '../webmcp/commands'
import { approvePendingComparison, cancelGeneration, runGenerationRoute } from '../ai/generation'
import { appStore, useAppStore } from '../state/store'
import type { ComparisonRoute, GenerationRouteState } from '../types/maptruth'

// A real run captured from production. Judges and first-time visitors see the
// payoff immediately instead of three empty boxes and a two-minute wait.
export const EXAMPLE_PROMPT = 'A 1970s Swiss travel poster of Kyoto in autumn'
const exampleImage: Record<ComparisonRoute, string> = {
  promptOnly: '/example/level-1.jpg',
  screenshotGrounded: '/example/level-2.jpg',
}

const routeCopy: Record<ComparisonRoute, { number: string; title: string; description: string; risk: string; riskClass: string }> = {
  promptOnly: { number: 'WITHOUT', title: 'No map', description: 'The AI never saw one. It invents a city that does not exist.', risk: 'Not a real place', riskClass: 'high' },
  screenshotGrounded: { number: 'WITH', title: 'Grounded by WebMCP', description: 'The agent found the place, locked it, and handed over the real map.', risk: 'Real place', riskClass: 'locked' },
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

function ResultVisual({ route, state }: { route: ComparisonRoute; state: GenerationRouteState }) {
  if (state.status === 'generating' || state.status === 'queued' || state.status === 'awaiting_approval') return <RouteProgress key={state.status} route={route} state={state} />
  if (state.status === 'ready' && state.imageDataUrl) {
    return <img src={state.imageDataUrl} alt={`${routeCopy[route].title} GPT Image result`} />
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
  return (
    <div className="taste-example">
      <img src={exampleImage[route]} alt={`Example ${routeCopy[route].title.toLowerCase()} result for ${EXAMPLE_PROMPT}`} loading="lazy" />
      <span className="taste-example-tag">Example</span>
    </div>
  )
}

export function ComparisonGrid() {
  const ai = useAppStore((state) => state.ai)
  const locked = useAppStore((state) => Boolean(state.data.lock))
  const placeName = useAppStore((state) => state.place.name)
  const generated = Object.values(ai.routes).some((route) => route.status === 'ready')
  const [zoomed, setZoomed] = useState<ComparisonRoute | null>(null)

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
            <article className={`taste-card ${route === 'screenshotGrounded' ? 'taste-card--truth' : ''}`} key={route}>
              <div className="taste-number">{copy.number}</div>
              <h3>{copy.title}</h3>
              <p>{route === 'screenshotGrounded' && locked ? `Grounded on the real map of ${placeName}.` : copy.description}</p>
              <button
                type="button"
                className="taste-visual taste-visual--zoom"
                onClick={() => setZoomed(route)}
                aria-label={`View ${copy.title} full screen`}
              >
                <ResultVisual route={route} state={state} />
                <span className="taste-zoom-hint" aria-hidden="true">⤢</span>
              </button>
              <div className="card-status-row">
                <span className={`risk-tag risk-tag--${copy.riskClass}`}>{copy.risk}</span>
                {state.durationMs ? <span className="route-duration">{(state.durationMs / 1000).toFixed(0)}s</span> : null}
              </div>
              {locked && state.status === 'idle' ? (
                <button className="route-action" type="button" onClick={() => void runGenerationRoute(route)}>Make this one</button>
              ) : null}
              {state.status === 'ready' ? (
                <button className="route-action" type="button" onClick={() => void exportGroundedArtwork({ route })}>Download</button>
              ) : null}
            </article>
          )
        })}
      </div>
      <p className="taste-footnote">Map data © OpenStreetMap contributors</p>

      {zoomed ? (
        <Lightbox
          title={routeCopy[zoomed].title}
          caption={ai.routes[zoomed].status === 'ready' ? undefined : `Example · "${EXAMPLE_PROMPT}"`}
          onClose={() => setZoomed(null)}
        >
          <ResultVisual route={zoomed} state={ai.routes[zoomed]} />
        </Lightbox>
      ) : null}
    </section>
  )
}
