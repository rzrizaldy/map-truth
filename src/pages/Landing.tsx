import { SiteShell, HeroMap } from '../components/SiteShell'

export function LandingPage() {
  return (
    <SiteShell headerCode="NYC / 40°45′N">
      <section className="hero-section" id="top">
        <div className="hero-copy">
          <div className="section-kicker">WEBMCP-GROUNDED MAP ART</div>
          <h1>Art direction can wander.<br /><em>Geography cannot.</em></h1>
          <p>
            MapTruth is a thin demo for ChatGPT in Chrome and the WebMCP protocol. Pan a real OpenStreetMap vector map,
            lock the OSM vectors already on screen, write one prompt, and compare three GPT Image routes—blind, screenshot, and geometry-locked.
          </p>
          <a className="button button--primary hero-cta" href="/demo">Open the demo ↓</a>
          <p className="landing-secondary"><a href="/about">About the method</a> · Jakarta verification studio</p>
        </div>
        <div className="hero-map-wrap"><HeroMap /><span className="hero-stamp">LOOKS LIKE A MAP<br />ISN’T PROOF OF A MAP</span></div>
      </section>

      <section className="sequence" id="method">
        <article><span>01 / PROMPT</span><h2>Model blind</h2><p>GPT Image invents roads, landmarks, and routes with no geographic evidence.</p></article>
        <article><span>02 / SCREENSHOT</span><h2>Pixels as reference</h2><p>The page is captured and supplied as image context. Topology can still drift.</p></article>
        <article><span>03 / WEBMCP</span><h2>Live OSM locked</h2><p>The agent leaves visible receipts while source-backed geometry stays deterministic. It cannot move the city.</p></article>
      </section>
    </SiteShell>
  )
}
