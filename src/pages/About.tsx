import { useEffect } from 'react'
import { ComparisonGrid } from '../components/ComparisonGrid'
import { SiteShell, HeroMap } from '../components/SiteShell'
import { ManualControls, StatusRail } from '../components/StudioPanels'
import { MapStudio } from '../map/MapStudio'
import { TruthSeam } from '../poster/TruthSeam'
import { registerMapTruthTools } from '../webmcp/register'
import { resetAboutState, useAppStore } from '../state/store'

export function AboutPage() {
  const data = useAppStore((state) => state.data)

  useEffect(() => {
    resetAboutState()
    let cleanup: () => void = () => undefined
    registerMapTruthTools().then((dispose) => { cleanup = dispose })
    return () => cleanup()
  }, [])

  return (
    <SiteShell headerCode={data.lock?.kind === 'verified' ? 'OSM VERIFIED' : 'JKT / LIVE OSM'}>
      <section className="hero-section" id="top">
        <div className="hero-copy">
          <div className="section-kicker">WEBMCP-GROUNDED MAP ART</div>
          <h1>Art direction can wander.<br /><em>Geography cannot.</em></h1>
          <p>MapTruth lets people and agents style a map without inventing the map. Every visible path carries a live source identity and geometry hash.</p>
          <a className="button button--primary hero-cta" href="/demo">Try the worldwide demo ↓</a>
        </div>
        <div className="hero-map-wrap"><HeroMap /><span className="hero-stamp">LOOKS LIKE A MAP<br />ISN’T PROOF OF A MAP</span></div>
      </section>

      <section className="sequence" id="method">
        <article><span>01 / SOURCE</span><h2>Lock what is live</h2><p>The OSM vectors already loaded in MapLibre become traceable paths with stable viewport IDs and geometry hashes.</p></article>
        <article><span>02 / STYLE</span><h2>Invite expression</h2><p>Prompts, presets, palettes, and GPT Image change the visual language—not the coordinate source.</p></article>
        <article><span>03 / VERIFY</span><h2>Drag the truth seam</h2><p>Reveal the neutral source beneath the poster and inspect the same feature IDs and geometry hashes.</p></article>
      </section>

      <section className="studio-section" id="studio">
        <div className="studio-title">
          <div><span className="section-kicker">JAKARTA STARTING CAMERA · WORLDWIDE SOURCE</span><h2>Ground-truth studio</h2></div>
          <p>Jakarta is a starting camera, not a bundled dataset. Draw a line or polygon, then style and verify the live OSM lock.</p>
        </div>
        <StatusRail />
        {data.status === 'error' ? <div className="ai-error">Live OSM lock failed: {data.error}</div> : null}
        <div className="studio-grid">
          <div className="source-column"><div className="panel-heading"><span>A / LIVE OSM CANVAS</span><strong>Draw the truth boundary</strong></div><MapStudio mode="about" /></div>
          <div className="poster-column"><div className="panel-heading"><span>B / VERIFIED OUTPUT</span><strong>Drag the center survey ruler</strong></div><TruthSeam /></div>
          <ManualControls />
        </div>
      </section>

      <ComparisonGrid />
    </SiteShell>
  )
}
