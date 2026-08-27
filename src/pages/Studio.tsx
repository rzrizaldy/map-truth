import { useEffect } from 'react'
import { ComparisonGrid } from '../components/ComparisonGrid'
import { SiteShell } from '../components/SiteShell'
import { AgentReceiptRail, StatusRail } from '../components/StudioPanels'
import { TruthSeam } from '../poster/TruthSeam'
import { MapStudio } from '../map/MapStudio'
import { exportGroundedArtwork, lockLiveOsm, verifyOsmLock } from '../webmcp/commands'
import { registerMapTruthTools } from '../webmcp/register'
import { appStore, resetStudioState, useAppStore } from '../state/store'

const stepClass = (done: boolean, ready: boolean) =>
  `step ${done ? 'step--done' : ready ? '' : 'step--waiting'}`

export function StudioPage() {
  const data = useAppStore((state) => state.data)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const locked = Boolean(data.lock)

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
    <SiteShell headerCode={data.lock?.kind === 'verified' ? 'OSM VERIFIED' : locked ? 'OSM LOCKED' : 'WEBMCP'}>
      <section className="hero-section" id="top">
        <div className="section-kicker">WEBMCP · LIVE OPENSTREETMAP · GPT IMAGE 2</div>
        <h1>Art direction can wander.<br /><em>Geography cannot.</em></h1>
        <p>
          One prompt, three images. The only thing that changes is how much real map the AI was given:
          nothing, a screenshot, or the actual OpenStreetMap geometry through WebMCP.
        </p>
      </section>

      <section className={stepClass(locked, mapReady)} id="step-1">
        <div className="step-head">
          <span className="step-num">1</span>
          <h2>Lock a place</h2>
          <p>Pan anywhere on Earth, then lock it. The OSM vectors already on screen become hashed, traceable geometry in milliseconds.</p>
        </div>

        <StatusRail />

        <div className="demo-toolbar">
          <button className="button button--primary" type="button" onClick={() => void onLock()} disabled={!mapReady || data.status === 'loading'}>
            {data.status === 'loading' ? 'Locking…' : locked ? 'Re-lock this view' : 'Lock this view'}
          </button>
          <button className="button" type="button" onClick={() => void verifyOsmLock()} disabled={!locked || data.verificationStatus === 'verifying'}>
            {data.verificationStatus === 'verifying' ? 'Verifying…' : 'Verify with Overpass'}
          </button>
          <span className="demo-toolbar-note">Overpass is optional—it only upgrades tile IDs to canonical OSM IDs.</span>
        </div>

        {data.error ? <div className="ai-error">{data.error}</div> : null}
        {data.verificationError ? <div className="verification-note">Overpass did not verify this lock. Live OSM geometry remains active. {data.verificationError}</div> : null}

        <MapStudio />
      </section>

      <ComparisonGrid />

      {locked ? (
        <section className="step step--done" id="step-4">
          <div className="step-head">
            <span className="step-num">✓</span>
            <h2>Prove it</h2>
            <p>Route 03’s art layer sits beneath exact OSM vectors. Drag the seam to reveal the neutral source—same feature IDs, same geometry hashes, same coordinates.</p>
          </div>
          <TruthSeam />
          <div className="seam-actions">
            <button className="button button--small" type="button" onClick={() => void exportGroundedArtwork({ format: 'svg' })}>Export SVG</button>
            <button className="button button--small" type="button" onClick={() => void exportGroundedArtwork({ format: 'png' })}>Export PNG</button>
          </div>
        </section>
      ) : null}

      <AgentReceiptRail />
    </SiteShell>
  )
}
