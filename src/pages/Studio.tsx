import { useEffect, useState } from 'react'
import { ComparisonGrid } from '../components/ComparisonGrid'
import { PromptStep } from '../components/PromptStep'
import { SiteShell } from '../components/SiteShell'
import { AgentReceiptRail, StatusRail } from '../components/StudioPanels'
import { AgentWalkthrough } from '../components/AgentWalkthrough'
import { MapStudio } from '../map/MapStudio'
import { lockLiveOsm, verifyOsmLock } from '../webmcp/commands'
import { registerMapTruthTools } from '../webmcp/register'
import { appStore, resetStudioState, useAppStore } from '../state/store'

export function StudioPage() {
  const data = useAppStore((state) => state.data)
  const place = useAppStore((state) => state.place)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const [showDetails, setShowDetails] = useState(false)
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
        data: { ...state.data, status: 'idle', error: 'Zoom in a bit closer, then try again.' },
      }))
    }
  }

  return (
    <SiteShell headerCode={locked ? place.name : 'MapTruth'}>
      <section className="hero-section" id="top">
        <div className="section-kicker">WEBMCP · GROUND TRUTH FOR AI-GENERATED MAPS</div>
        <h1>A made-up map<br /><em>looks exactly like a real one.</em></h1>
        <p>
          Ask any image model for a map of somewhere real and it will invent the streets — confidently,
          beautifully, and with a legend. That is fine for wall art and dangerous for a protest route,
          an evacuation plan or a delivery zone.
        </p>
        <p className="hero-note">
          MapTruth gives the model the actual place instead. Type a prompt, and an agent finds it in
          OpenStreetMap, locks the real viewport, pins what you named at its true coordinates, and hands
          that over. You get the same prompt both ways — and every claim on the grounded one is checkable.
        </p>
      </section>

      <PromptStep />

      <section className={`step ${locked ? 'step--done' : mapReady ? '' : 'step--waiting'}`} id="step-2">
        <div className="step-head">
          <span className="step-num">2</span>
          <h2>Pick the place</h2>
          <p>Drag the map anywhere, then keep the view. This exact map is what the image model gets.</p>
        </div>

        <StatusRail />

        <div className="demo-toolbar">
          <button className="button button--primary" type="button" onClick={() => void onLock()} disabled={!mapReady || data.status === 'loading'}>
            {data.status === 'loading' ? 'Reading the map…' : locked ? 'Use this view instead' : 'Use this view'}
          </button>
        </div>

        {data.error ? <div className="ai-error">{data.error}</div> : null}

        <MapStudio />
      </section>

      <AgentWalkthrough />

      <ComparisonGrid />

      <details className="details-panel" open={showDetails} onToggle={(event) => setShowDetails(event.currentTarget.open)}>
        <summary>Under the hood</summary>
        <div className="details-body">
          <p>
            Locking reads the OpenStreetMap vectors your browser already downloaded and fingerprints every
            shape, so the grounded image can be checked line by line. Optionally re-fetch the same area from
            OpenStreetMap’s canonical database to swap in official feature IDs.
          </p>
          <div className="demo-toolbar">
            <button className="button button--small" type="button" onClick={() => void verifyOsmLock()} disabled={!locked || data.verificationStatus === 'verifying'}>
              {data.verificationStatus === 'verifying' ? 'Checking…' : 'Double-check against OpenStreetMap'}
            </button>
            {data.lock ? <span className="demo-toolbar-note">{data.lock.featureCount.toLocaleString()} shapes · {data.lock.geometryHash}</span> : null}
          </div>
          {data.verificationError ? <div className="verification-note">Couldn’t reach OpenStreetMap just now. Your locked map is unchanged.</div> : null}
          <AgentReceiptRail />
        </div>
      </details>
    </SiteShell>
  )
}
