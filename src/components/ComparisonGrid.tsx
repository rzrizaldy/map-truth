import { PosterSvg } from '../poster/PosterSvg'
import { appStore, useAppStore } from '../state/store'
import { getMapContext } from '../webmcp/commands'

const MODEL = 'openai/gpt-image-2' as const

type ComparisonGridProps = {
  captureRef: React.MutableRefObject<(() => string) | null>
  compact?: boolean
}

export function ComparisonGrid({ captureRef, compact = false }: ComparisonGridProps) {
  const ai = useAppStore((state) => state.ai)
  const data = useAppStore((state) => state.data)
  const selection = useAppStore((state) => state.selection)

  const generate = async () => {
    if (!selection || data.status !== 'ready' || !data.features.length) {
      appStore.setState((current) => ({
        ai: { ...current.ai, status: 'error', error: 'Set boundary on the map before generating posters.' },
      }))
      return
    }
    const screenshot = captureRef.current?.()
    if (!screenshot) {
      appStore.setState((current) => ({ ai: { ...current.ai, status: 'error', error: 'The source map is not ready yet.' } }))
      return
    }
    appStore.setState((current) => ({ ai: { ...current.ai, status: 'generating', error: undefined } }))
    const context = getMapContext()
    try {
      const response = await fetch('/api/generate-comparison', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: appStore.getState().ai.prompt, sourceImageDataUrl: screenshot, mapSummary: JSON.stringify(context) }),
      })
      const payload = await response.json() as { images?: Record<string, string>; error?: string; detail?: string }
      if (!response.ok || !payload.images) throw new Error(payload.detail ?? payload.error ?? `Request failed (${response.status})`)
      appStore.setState((current) => ({
        ai: {
          ...current.ai,
          status: 'ready',
          result: {
            promptOnly: payload.images!.promptOnly,
            screenshotGrounded: payload.images!.screenshotGrounded,
            mapTruthArtLayer: payload.images!.mapTruthArtLayer,
            model: MODEL,
          },
        },
      }))
    } catch (error) {
      appStore.setState((current) => ({ ai: { ...current.ai, status: 'error', error: String(error) } }))
    }
  }

  return (
    <section className={`taste-section ${compact ? 'taste-section--compact' : ''}`} id="comparison">
      {!compact ? (
        <div className="taste-intro taste-intro--demo">
          <div>
            <div className="section-kicker">THREE ROUTES · ONE PROMPT</div>
            <h2>Same brief. Three relationships to geographic truth.</h2>
          </div>
          <div>
            <label htmlFor="ai-prompt">Prompt sent to GPT Image 2</label>
            <textarea
              id="ai-prompt"
              value={ai.prompt}
              maxLength={1200}
              onChange={(event) => appStore.setState((current) => ({ ai: { ...current.ai, prompt: event.target.value } }))}
            />
            <button className="button button--generate" type="button" onClick={generate} disabled={ai.status === 'generating'}>
              {ai.status === 'generating' ? 'Generating three versions…' : 'Generate 3 versions with GPT Image 2'}
            </button>
            <small>Route 1 is blind. Route 2 uses a page screenshot. Route 3 locks OSM vectors through WebMCP.</small>
          </div>
        </div>
      ) : null}
      {ai.error ? <div className="ai-error"><strong>Generation did not run.</strong> {ai.error}</div> : null}
      <div className="taste-grid">
        <article className="taste-card">
          <div className="taste-number">01</div><h3>Prompt only</h3><p>GPT Image with no map evidence.</p>
          <div className="taste-visual">{ai.result ? <img src={ai.result.promptOnly} alt="Prompt-only GPT Image result" /> : <div className="taste-empty">No map evidence<br />Maximum invention</div>}</div>
          <span className="risk-tag risk-tag--high">Geography: unverified</span>
        </article>
        <article className="taste-card">
          <div className="taste-number">02</div><h3>Map screenshot</h3><p>Visible map captured as image-edit context.</p>
          <div className="taste-visual">{ai.result ? <img src={ai.result.screenshotGrounded} alt="Map screenshot guided GPT Image result" /> : <div className="taste-empty taste-empty--screen">Pixels as reference<br />Geometry may drift</div>}</div>
          <span className="risk-tag risk-tag--medium">Geography: visually guided</span>
        </article>
        <article className="taste-card taste-card--truth">
          <div className="taste-number">03</div><h3>MapTruth + WebMCP</h3><p>Art layer only. OSM vectors stay geometry-locked.</p>
          <div className="taste-visual">{ai.result ? <PosterSvg backgroundImage={ai.result.mapTruthArtLayer} /> : <PosterSvg />}</div>
          <span className="risk-tag risk-tag--locked">Geography: geometry-locked</span>
        </article>
      </div>
    </section>
  )
}
