import { SiteShell } from '../components/SiteShell'

const tools = [
  ['inspect_map_context', 'Read the current viewport, place, lock, and feature classes.'],
  ['navigate_map', 'Move to explicit coordinates without silently changing the artwork.'],
  ['focus_place', 'Resolve a human place name, move there, and lock its live map.'],
  ['lock_live_osm', 'Freeze the OSM-derived shapes visible in the current viewport.'],
  ['verify_osm_lock', 'Replace tile fragments with canonical Overpass entities when available.'],
  ['mark_from_osm', 'Interpret the brief, then place only OSM-resolved markers.'],
  ['generate_comparison', 'Stage both image routes behind a visible human cost gate.'],
  ['inspect_comparison', 'Read route status without mutating or spending anything.'],
  ['verify_geography', 'Check that every locked geographic feature has source evidence.'],
  ['export_artwork', 'Download a completed result; its source provenance remains visible in the page.'],
] as const

const layers = [
  {
    number: '01', label: 'Human brief', title: 'Intent stays legible',
    copy: 'A person chooses a real place and writes the map they need. MapTruth reads its interpretation back before generation.',
    proof: 'Place + brief + visible approval',
  },
  {
    number: '02', label: 'Model reasoning', title: 'Names, never coordinates',
    copy: 'A language model may choose from a closed marker vocabulary or suggest high-confidence local names. It cannot place anything on the map.',
    proof: 'Bounded JSON · no coordinates',
  },
  {
    number: '03', label: 'OSM grounding', title: 'The map decides where',
    copy: 'Nominatim resolves the place. MapLibre supplies the visible OSM-derived geometry. Bounded Overpass lookups keep only named places found inside the lock.',
    proof: 'BBox + source IDs + geometry hash',
  },
  {
    number: '04', label: 'Image route', title: 'Style receives evidence',
    copy: 'GPT Image receives the brief plus the captured source map. It redraws the poster; MapTruth preserves the source line so the evidence remains inspectable.',
    proof: 'Capture + compact lock summary',
  },
] as const

export function AboutPage() {
  return (
    <SiteShell headerCode="ABOUT / ARCHITECTURE" documentPage>
      <div className="about-page">
        <section className="about-hero">
          <div className="about-hero-copy">
            <p className="section-kicker">A WEBMCP GEOGRAPHY PROOF</p>
            <h1>A model can style evidence.<br /><em>It cannot invent it.</em></h1>
            <p>
              MapTruth is a small argument made visible: when an AI creates a map of a real place,
              geographic evidence should reach it before visual taste does.
            </p>
            <div className="about-actions">
              <a className="button button--primary" href="/">Try the two-map test →</a>
              <a className="button" href="#architecture">See the architecture</a>
            </div>
          </div>
          <figure className="brand-proof">
            <img src="/brand/maptruth-mark.png" alt="MapTruth survey alignment mark" />
            <figcaption>
              <span>THE MARK</span>
              <strong>Two routes. One registration point.</strong>
              <p>Generated as a brand study, then cleaned and reduced for the product system.</p>
            </figcaption>
          </figure>
        </section>

        <section className="about-manifesto" aria-label="Project premise">
          <p className="about-index">00 / PREMISE</p>
          <blockquote>“A made-up map looks exactly like a real one.”</blockquote>
          <p>
            That is harmless for fantasy art and dangerous for protest routes, evacuation plans, delivery zones,
            or anything else where a convincing street can send someone to the wrong place.
          </p>
        </section>

        <section className="about-section" id="architecture">
          <div className="section-heading">
            <div><p className="about-index">01 / ARCHITECTURE</p><h2>Reason about intent.<br />Ground every position.</h2></div>
            <p>The system gives each layer one job. No component is allowed to quietly promote a guess into geography.</p>
          </div>
          <div className="architecture-flow">
            {layers.map((layer, index) => (
              <article className="architecture-card" key={layer.number}>
                <div className="architecture-top"><span>{layer.number}</span><code>{layer.label}</code></div>
                <h3>{layer.title}</h3>
                <p>{layer.copy}</p>
                <small>{layer.proof}</small>
                {index < layers.length - 1 ? <i aria-hidden="true">↓</i> : null}
              </article>
            ))}
          </div>
          <div className="architecture-rule">
            <span>MODEL</span><b>what belongs on the map</b><span>OPENSTREETMAP</span><b>where it actually is</b>
          </div>
        </section>

        <section className="about-section truth-section" id="truth-contract">
          <div className="section-heading">
            <div><p className="about-index">02 / TRUTH CONTRACT</p><h2>Precise claims beat<br />impressive claims.</h2></div>
            <p>The grounded poster is still a generative redraw. What MapTruth verifies is the evidence supplied to it—not every pixel the image model produces.</p>
          </div>
          <div className="truth-grid">
            <article className="truth-card truth-card--yes">
              <span>WE CAN CHECK</span>
              <ul>
                <li>The resolved place and locked bounding box</li>
                <li>OSM-derived source shapes in the captured viewport</li>
                <li>Geometry hashes and source identities</li>
                <li>Named markers resolved inside that lock</li>
                <li>The exact evidence route used for generation</li>
              </ul>
            </article>
            <article className="truth-card truth-card--no">
              <span>WE DO NOT CLAIM</span>
              <ul>
                <li>That OpenStreetMap is perfectly complete or current</li>
                <li>That generated pixels are cartographically exact</li>
                <li>That a model’s judgment of “best” is objective</li>
                <li>That an unresolved name exists at a guessed location</li>
                <li>That a provider request succeeded before it completes</li>
              </ul>
            </article>
          </div>
        </section>

        <section className="about-section" id="webmcp">
          <div className="section-heading">
            <div><p className="about-index">03 / WEBMCP</p><h2>Ten typed tools.<br />One visible cost gate.</h2></div>
            <p>Manual controls and WebMCP call the same command functions. Mutations leave receipts; paid generation waits for a person.</p>
          </div>
          <div className="tool-grid">
            {tools.map(([name, description], index) => (
              <article className="tool-card" key={name}>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <code>{name}</code>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-cta">
          <p className="section-kicker">THE TEST IS THE PRODUCT</p>
          <h2>Give the same brief to both routes.</h2>
          <p>The attractive wrong answer is the control. The sourced answer is the intervention.</p>
          <a className="button button--primary" href="/">Open MapTruth studio →</a>
        </section>
      </div>
    </SiteShell>
  )
}
