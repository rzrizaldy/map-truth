import { useEffect, useRef } from 'react'
import type { SourceFeatureCollection } from './types/maptruth'
import { appStore, useAppStore } from './state/store'
import { MapStudio } from './map/MapStudio'
import { TruthSeam } from './poster/TruthSeam'
import { PosterSvg } from './poster/PosterSvg'
import { demoRoute, featuresInContext } from './map/context'
import { hashGeometrySync } from './lib/hash'
import { exportGroundedArtwork, getMapContext, renderGroundedPoster, verifyGeography } from './webmcp/commands'
import { registerMapTruthTools } from './webmcp/register'
import './App.css'

const MODEL = 'openai/gpt-image-2' as const

function HeroMap() {
  return (
    <svg viewBox="0 0 440 360" role="img" aria-label="Illustrative fabricated map poster demonstrating invented geography">
      <rect width="440" height="360" fill="#D43D28" />
      <path d="M-20 270C90 180 105 232 206 146S322 95 465 25" fill="none" stroke="#FFF9EC" strokeWidth="26" />
      <path d="M48 28L155 330M330 6L256 359M15 125L418 257" fill="none" stroke="#141512" strokeWidth="7" />
      <path d="M80 70L172 98L146 176L54 149ZM300 198L400 220L372 309L282 279Z" fill="#F2E7CF" stroke="#141512" strokeWidth="5" />
      <circle cx="223" cy="155" r="22" fill="#141512" />
      <text x="24" y="338" fontFamily="IBM Plex Mono,monospace" fontSize="13" fill="#FFF9EC" letterSpacing="2">ILLUSTRATIVE / FABRICATED MAP</text>
    </svg>
  )
}

function StatusRail() {
  const ui = useAppStore((state) => state.ui)
  const selection = useAppStore((state) => state.selection)
  const poster = useAppStore((state) => state.poster)
  return (
    <div className="status-rail" aria-label="Geography status">
      <div><span className="status-dot" /> GEOGRAPHY LOCKED</div>
      <strong>{poster.renderedFeatureIds.length.toLocaleString() || '—'} source paths</strong>
      <span>{selection ? `${selection.kind} ${selection.geometryHash.slice(0, 13)}` : 'waiting for geometry'}</span>
      <span className={`webmcp-pill webmcp-pill--${ui.webmcpStatus}`}>WebMCP {ui.webmcpStatus}</span>
    </div>
  )
}

function ManualControls() {
  const spec = useAppStore((state) => state.poster.spec)
  const activity = useAppStore((state) => state.activity)
  const webmcp = useAppStore((state) => state.ui)
  const update = (patch: Partial<typeof spec>) => appStore.setState((state) => ({
    poster: { ...state.poster, spec: { ...state.poster.spec, ...patch } },
  }))

  return (
    <aside className="controls-panel">
      <div className="panel-heading"><span>MANUAL FALLBACK</span><strong>Art direction</strong></div>
      <label>Title<input value={spec.title} maxLength={80} onChange={(event) => update({ title: event.target.value })} /></label>
      <label>Subtitle<input value={spec.subtitle ?? ''} maxLength={140} onChange={(event) => update({ subtitle: event.target.value })} /></label>
      <label>Preset
        <select value={spec.preset} onChange={(event) => update({ preset: event.target.value as typeof spec.preset })}>
          <option value="editorial">Editorial</option><option value="retro">Retro civic</option><option value="blueprint">Blueprint</option>
        </select>
      </label>
      <label>Palette
        <select value={spec.palette} onChange={(event) => update({ palette: event.target.value as typeof spec.palette })}>
          <option value="red-cream-black">Dispatch red</option><option value="blue-white">Survey blue</option><option value="sunset">Jakarta sunset</option>
        </select>
      </label>
      <label>Labels
        <select value={spec.labelDensity} onChange={(event) => update({ labelDensity: event.target.value as typeof spec.labelDensity })}>
          <option value="minimal">Minimal</option><option value="balanced">Balanced</option><option value="detailed">Detailed</option>
        </select>
      </label>
      <label className="legend-toggle">
        <input type="checkbox" checked={spec.showLegend} onChange={(event) => update({ showLegend: event.target.checked })} />
        Show legend
      </label>
      <div className="button-row">
        <button className="button button--primary" type="button" onClick={() => renderGroundedPoster(appStore.getState().poster.spec)}>Render grounded</button>
        <button className="button" type="button" onClick={() => verifyGeography()}>Verify</button>
      </div>
      <div className="button-row">
        <button className="button button--small" type="button" onClick={() => exportGroundedArtwork({ format: 'svg' })}>Export SVG</button>
        <button className="button button--small" type="button" onClick={() => exportGroundedArtwork({ format: 'png' })}>Export PNG</button>
      </div>
      <div className={`compatibility compatibility--${webmcp.webmcpStatus}`}>
        <strong>{webmcp.webmcpAvailable ? '5 tools registered' : 'Manual studio active'}</strong>
        <p>{webmcp.webmcpMessage ?? 'Checking this browser for document.modelContext…'}</p>
      </div>
      <div className="activity-log">
        <span>ACTIVITY</span>
        {activity.length ? activity.map((entry) => (
          <div key={entry.id}><time>{entry.time}</time><p><b>{entry.tool}</b> · {entry.summary}</p></div>
        )) : <p>No tool calls yet.</p>}
      </div>
    </aside>
  )
}

type TasteProps = { captureRef: React.MutableRefObject<(() => string) | null> }

function AiTasteTest({ captureRef }: TasteProps) {
  const ai = useAppStore((state) => state.ai)

  const generate = async () => {
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
        ai: { ...current.ai, status: 'ready', result: {
          promptOnly: payload.images!.promptOnly,
          screenshotGrounded: payload.images!.screenshotGrounded,
          mapTruthArtLayer: payload.images!.mapTruthArtLayer,
          model: MODEL,
        } },
      }))
    } catch (error) {
      appStore.setState((current) => ({ ai: { ...current.ai, status: 'error', error: String(error) } }))
    }
  }

  return (
    <section className="taste-section" id="taste-test">
      <div className="section-kicker">THE THREE-WAY TASTE TEST</div>
      <div className="taste-intro">
        <h2>Same brief. Three very different relationships to truth.</h2>
        <div>
          <label htmlFor="ai-prompt">Prompt sent to GPT Image 2</label>
          <textarea id="ai-prompt" value={ai.prompt} maxLength={1200} onChange={(event) => appStore.setState((current) => ({ ai: { ...current.ai, prompt: event.target.value } }))} />
          <button className="button button--generate" type="button" onClick={generate} disabled={ai.status === 'generating'}>
            {ai.status === 'generating' ? 'Generating three versions…' : 'Generate 3 versions with GPT Image 2'}
          </button>
          <small>One action makes three real image-generation calls through Vercel AI Gateway. No mock fallback.</small>
        </div>
      </div>
      {ai.error ? <div className="ai-error"><strong>Generation did not run.</strong> {ai.error} Use <code>vercel dev</code> with AI Gateway authentication for the live demo.</div> : null}
      <div className="taste-grid">
        <article className="taste-card">
          <div className="taste-number">01</div><h3>Prompt only</h3><p>GPT Image interprets a well-engineered prompt with no geographic source.</p>
          <div className="taste-visual">{ai.result ? <img src={ai.result.promptOnly} alt="Prompt-only GPT Image result" /> : <div className="taste-empty">No map evidence<br />Maximum invention</div>}</div>
          <span className="risk-tag risk-tag--high">Geography: unverified</span>
        </article>
        <article className="taste-card">
          <div className="taste-number">02</div><h3>Map screenshot</h3><p>The visible source map is auto-captured and supplied as image-edit context.</p>
          <div className="taste-visual">{ai.result ? <img src={ai.result.screenshotGrounded} alt="Map screenshot guided GPT Image result" /> : <div className="taste-empty taste-empty--screen">Pixels as reference<br />Geometry may drift</div>}</div>
          <span className="risk-tag risk-tag--medium">Geography: visually guided</span>
        </article>
        <article className="taste-card taste-card--truth">
          <div className="taste-number">03</div><h3>MapTruth + WebMCP</h3><p>GPT Image supplies only art direction. Exact source paths are composited above it.</p>
          <div className="taste-visual">{ai.result ? <PosterSvg backgroundImage={ai.result.mapTruthArtLayer} /> : <PosterSvg />}</div>
          <span className="risk-tag risk-tag--locked">Geography: geometry-locked</span>
        </article>
      </div>
      <p className="taste-footnote">Version 3 is the only output where every geographic path remains inspectable by source ID and geometry hash.</p>
    </section>
  )
}

function App() {
  const captureRef = useRef<(() => string) | null>(null)
  const data = useAppStore((state) => state.data)

  useEffect(() => {
    let active = true
    fetch('/data/demo-area.geojson')
      .then((response) => response.json() as Promise<SourceFeatureCollection>)
      .then((collection) => {
        if (!active) return
        const selection = { kind: 'route' as const, id: 'human:route', geometry: demoRoute, geometryHash: hashGeometrySync(demoRoute) }
        const seededState = { ...appStore.getState(), data: { status: 'ready' as const, features: collection.features }, selection }
        const renderedFeatureIds = featuresInContext(seededState).map((feature) => feature.properties.id)
        appStore.setState((state) => ({ data: { status: 'ready', features: collection.features }, selection, poster: { ...state.poster, status: 'ready', renderedFeatureIds } }))
      })
      .catch((error) => active && appStore.setState({ data: { status: 'error', features: [], error: String(error) } }))
    return () => { active = false }
  }, [])

  useEffect(() => {
    let cleanup: () => void = () => undefined
    registerMapTruthTools().then((dispose) => { cleanup = dispose })
    return () => cleanup()
  }, [])

  return (
    <main>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="MapTruth home"><span>MAP</span>TRUTH</a>
        <nav><a href="#studio">Studio</a><a href="#taste-test">3-way demo</a><a href="#method">Method</a></nav>
        <span className="header-code">JKT / 06°12′S</span>
      </header>

      <section className="hero-section" id="top">
        <div className="hero-copy">
          <div className="section-kicker">WEBMCP-GROUNDED MAP ART</div>
          <h1>Art direction can wander.<br /><em>Geography cannot.</em></h1>
          <p>MapTruth lets people and agents style a map without ever inventing the map. Every road, canal, park, landmark, and drawn route stays tied to its source geometry.</p>
          <a className="button button--primary hero-cta" href="#studio">Open the verification studio ↓</a>
        </div>
        <div className="hero-map-wrap"><HeroMap /><span className="hero-stamp">LOOKS LIKE A MAP<br />ISN’T PROOF OF A MAP</span></div>
      </section>

      <section className="sequence" id="method">
        <article><span>01 / SOURCE</span><h2>Pin the facts</h2><p>A checksummed local OpenStreetMap extract, stable IDs, and a human-drawn route define what may appear.</p></article>
        <article><span>02 / STYLE</span><h2>Invite expression</h2><p>Prompts, presets, palettes, and GPT Image change the visual language—not the coordinate source.</p></article>
        <article><span>03 / VERIFY</span><h2>Drag the truth seam</h2><p>Reveal the neutral source beneath the poster and inspect the same feature IDs and geometry hashes.</p></article>
      </section>

      <section className="studio-section" id="studio">
        <div className="studio-title"><div><span className="section-kicker">CENTRAL JAKARTA — SENAYAN</span><h2>Ground-truth studio</h2></div><p>Draw a line or polygon. Then style, verify, compare, and export—entirely from the pinned local dataset.</p></div>
        <StatusRail />
        {data.status === 'error' ? <div className="ai-error">Dataset failed to load: {data.error}</div> : null}
        <div className="studio-grid">
          <div className="source-column"><div className="panel-heading"><span>A / SOURCE CATALOG</span><strong>Draw the truth boundary</strong></div><MapStudio captureRef={captureRef} /></div>
          <div className="poster-column"><div className="panel-heading"><span>B / VERIFIED OUTPUT</span><strong>Drag the center survey ruler</strong></div><TruthSeam /></div>
          <ManualControls />
        </div>
      </section>

      <AiTasteTest captureRef={captureRef} />

      <footer><div><strong>MAPTRUTH</strong><p>Provenance against a pinned OSM-derived dataset—not a claim that OSM is perfectly complete or current.</p></div><a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Map data © OpenStreetMap contributors · ODbL 1.0</a></footer>
    </main>
  )
}

export default App
