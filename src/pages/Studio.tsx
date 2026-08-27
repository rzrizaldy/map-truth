import { useEffect } from 'react'
import { ComparisonGrid } from '../components/ComparisonGrid'
import { SiteShell, FabricatedMap } from '../components/SiteShell'
import { AgentReceiptRail, StatusRail } from '../components/StudioPanels'
import { TruthSeam } from '../poster/TruthSeam'
import { MapStudio } from '../map/MapStudio'
import { exportGroundedArtwork, lockLiveOsm, verifyOsmLock } from '../webmcp/commands'
import { registerMapTruthTools } from '../webmcp/register'
import { appStore, resetStudioState, useAppStore } from '../state/store'

export function StudioPage() {
  const data = useAppStore((state) => state.data)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const routes = useAppStore((state) => state.ai.routes)
  const generated = Object.values(routes).some((route) => route.status === 'ready')

  useEffect(() => {
    resetStudioState()
    let cleanup: () => void = () => undefined
    void registerMapTruthTools().then((dispose) => { cleanup = dispose })
    return () => cleanup()
  }, [])

  const onLock = async () => {
    appStore.setState((state) => ({ data: { ...state.data, error: undefined } }))
    const result = await lockLiveOsm()
    if (result.status === 'needs_user_action' && result.reason === 'bbox_too_large') {
      appStore.setState((state) => ({
        data: { ...state.data, status: 'idle', error: 'Zoom in closer before locking geography.' },
      }))
    }
  }

  return (
    <SiteShell headerCode={data.lock?.kind === 'verified' ? 'OSM VERIFIED' : data.lock ? 'LIVE OSM LOCK' : 'WEBMCP'}>
      <section className="hero-section" id="top">
        <div className="hero-copy">
          <div className="section-kicker">WEBMCP · LIVE OPENSTREETMAP · GPT IMAGE 2</div>
          <h1>Art direction can wander.<br /><em>Geography cannot.</em></h1>
          <p>
            One prompt. Three images. The only thing that changes is how much real map the AI was given.
            Move the map, lock the OpenStreetMap vectors on screen, and watch invention collapse into evidence.
          </p>
          <a className="button button--primary hero-cta" href="#studio">Start on the map ↓</a>
        </div>
        <div className="hero-map-wrap">
          <FabricatedMap />
          <span className="hero-stamp">LOOKS LIKE A MAP<br />ISN’T PROOF OF A MAP</span>
        </div>
      </section>

      <section className="studio-section" id="studio">
        <div className="studio-title">
          <div>
            <span className="section-kicker">STEP 01 · MOVE AND LOCK</span>
            <h2>Pick a place. Lock the truth.</h2>
          </div>
          <p>Pan anywhere on Earth. The OSM vectors already loaded in the viewport become a hashed, traceable geometry lock in milliseconds—no waiting on Overpass.</p>
        </div>

        <div className="step-strip" aria-label="MapTruth workflow">
          <span className={mapReady ? 'done' : ''}>01 Move the map</span>
          <span className={data.lock ? 'done' : ''}>02 Lock live OSM</span>
          <span className={generated ? 'done' : ''}>03 Compare 3 images</span>
        </div>

        <StatusRail />

        <div className="demo-toolbar">
          <button className="button button--primary" type="button" onClick={() => void onLock()} disabled={!mapReady || data.status === 'loading'}>
            {data.status === 'loading' ? 'Locking loaded tiles…' : data.lock ? 'Re-lock this view' : 'Lock this view'}
          </button>
          <button className="button" type="button" onClick={() => void verifyOsmLock()} disabled={!data.lock || data.verificationStatus === 'verifying'}>
            {data.verificationStatus === 'verifying' ? 'Verifying…' : 'Verify with Overpass (optional)'}
          </button>
          <span className="demo-toolbar-note">Locking is instant. Overpass only upgrades tile IDs to canonical OSM IDs.</span>
        </div>

        {data.error ? <div className="ai-error">{data.error}</div> : null}
        {data.verificationError ? <div className="verification-note">Overpass did not verify this lock. Live OSM geometry remains active. {data.verificationError}</div> : null}

        <div className="demo-map-stage"><MapStudio /></div>
        <AgentReceiptRail />
      </section>

      <ComparisonGrid />

      {data.lock ? (
        <section className="studio-section" id="verify">
          <div className="studio-title">
            <div>
              <span className="section-kicker">STEP 03B · PROVE IT</span>
              <h2>Drag the truth seam.</h2>
            </div>
            <p>Route 03’s art layer sits beneath exact OSM vectors. Slide the ruler to reveal the neutral source underneath—same feature IDs, same geometry hashes, same coordinates.</p>
          </div>
          <div className="demo-verify-stage">
            <div className="panel-heading panel-heading--row">
              <div>
                <span>ROUTE 03 / GEOMETRY-LOCKED OUTPUT</span>
                <strong>{data.lock.featureCount.toLocaleString()} source paths · {data.lock.geometryHash.slice(0, 15)}</strong>
              </div>
              <div className="button-row button-row--flush">
                <button className="button button--small" type="button" onClick={() => void exportGroundedArtwork({ format: 'svg' })}>Export SVG</button>
                <button className="button button--small" type="button" onClick={() => void exportGroundedArtwork({ format: 'png' })}>Export PNG</button>
              </div>
            </div>
            <TruthSeam />
          </div>
        </section>
      ) : null}
    </SiteShell>
  )
}
