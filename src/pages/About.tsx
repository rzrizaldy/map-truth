import { useEffect, useRef } from 'react'
import type { SourceFeatureCollection } from '../types/maptruth'
import { ComparisonGrid } from '../components/ComparisonGrid'
import { SiteShell, HeroMap } from '../components/SiteShell'
import { ManualControls, StatusRail } from '../components/StudioPanels'
import { MapStudio } from '../map/MapStudio'
import { demoRoute, featuresInContext } from '../map/context'
import { TruthSeam } from '../poster/TruthSeam'
import { hashGeometrySync } from '../lib/hash'
import { registerMapTruthTools } from '../webmcp/register'
import { appStore, resetAboutState, useAppStore } from '../state/store'

export function AboutPage() {
  const captureRef = useRef<(() => string) | null>(null)
  const data = useAppStore((state) => state.data)

  useEffect(() => {
    resetAboutState()
    let active = true
    fetch('/data/demo-area.geojson')
      .then((response) => response.json() as Promise<SourceFeatureCollection>)
      .then((collection) => {
        if (!active) return
        const selection = { kind: 'route' as const, id: 'human:route', geometry: demoRoute, geometryHash: hashGeometrySync(demoRoute) }
        const seededState = { ...appStore.getState(), data: { status: 'ready' as const, features: collection.features }, selection }
        const renderedFeatureIds = featuresInContext(seededState).map((feature) => feature.properties.id)
        appStore.setState((state) => ({
          data: { status: 'ready', features: collection.features },
          selection,
          poster: { ...state.poster, status: 'ready', renderedFeatureIds },
        }))
      })
      .catch((error) => active && appStore.setState({ data: { status: 'error', features: [], error: String(error) } }))

    let cleanup: () => void = () => undefined
    registerMapTruthTools().then((dispose) => { cleanup = dispose })
    return () => {
      active = false
      cleanup()
    }
  }, [])

  return (
    <SiteShell headerCode="JKT / 06°12′S">
      <section className="hero-section" id="top">
        <div className="hero-copy">
          <div className="section-kicker">WEBMCP-GROUNDED MAP ART</div>
          <h1>Art direction can wander.<br /><em>Geography cannot.</em></h1>
          <p>MapTruth lets people and agents style a map without ever inventing the map. Every road, canal, park, landmark, and drawn route stays tied to its source geometry.</p>
          <a className="button button--primary hero-cta" href="/demo">Try the worldwide demo ↓</a>
        </div>
        <div className="hero-map-wrap"><HeroMap /><span className="hero-stamp">LOOKS LIKE A MAP<br />ISN’T PROOF OF A MAP</span></div>
      </section>

      <section className="sequence" id="method">
        <article><span>01 / SOURCE</span><h2>Pin the facts</h2><p>A checksummed local OpenStreetMap extract, stable IDs, and a human-drawn route define what may appear.</p></article>
        <article><span>02 / STYLE</span><h2>Invite expression</h2><p>Prompts, presets, palettes, and GPT Image change the visual language—not the coordinate source.</p></article>
        <article><span>03 / VERIFY</span><h2>Drag the truth seam</h2><p>Reveal the neutral source beneath the poster and inspect the same feature IDs and geometry hashes.</p></article>
      </section>

      <section className="studio-section" id="studio">
        <div className="studio-title">
          <div><span className="section-kicker">CENTRAL JAKARTA — SENAYAN</span><h2>Ground-truth studio</h2></div>
          <p>Draw a line or polygon. Then style, verify, compare, and export—entirely from the pinned local dataset.</p>
        </div>
        <StatusRail />
        {data.status === 'error' ? <div className="ai-error">Dataset failed to load: {data.error}</div> : null}
        <div className="studio-grid">
          <div className="source-column"><div className="panel-heading"><span>A / SOURCE CATALOG</span><strong>Draw the truth boundary</strong></div><MapStudio mode="about" captureRef={captureRef} /></div>
          <div className="poster-column"><div className="panel-heading"><span>B / VERIFIED OUTPUT</span><strong>Drag the center survey ruler</strong></div><TruthSeam /></div>
          <ManualControls />
        </div>
      </section>

      <ComparisonGrid captureRef={captureRef} />
    </SiteShell>
  )
}
