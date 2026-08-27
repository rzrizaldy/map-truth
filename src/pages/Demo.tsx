import { useEffect } from 'react'
import { ComparisonGrid } from '../components/ComparisonGrid'
import { SiteShell } from '../components/SiteShell'
import { AgentReceiptRail, StatusRail } from '../components/StudioPanels'
import { TruthSeam } from '../poster/TruthSeam'
import { MapStudio } from '../map/MapStudio'
import { lockLiveOsm, verifyOsmLock } from '../webmcp/commands'
import { registerMapTruthTools } from '../webmcp/register'
import { appStore, resetDemoState, useAppStore } from '../state/store'

export function DemoPage() {
  const data = useAppStore((state) => state.data)
  const place = useAppStore((state) => state.place)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const routes = useAppStore((state) => state.ai.routes)

  useEffect(() => {
    resetDemoState()
    let cleanup: () => void = () => undefined
    registerMapTruthTools().then((dispose) => { cleanup = dispose })
    return () => cleanup()
  }, [])

  const onLockBoundary = async () => {
    appStore.setState((state) => ({ data: { ...state.data, error: undefined } }))
    const result = await lockLiveOsm()
    if (result.status === 'needs_user_action' && result.reason === 'bbox_too_large') {
      appStore.setState((state) => ({
        data: { ...state.data, status: 'idle', error: 'Zoom in closer before locking geography.' },
      }))
    }
  }

  return (
    <SiteShell headerCode={place.source === 'overpass' ? 'OSM VERIFIED' : data.lock ? 'LIVE OSM' : 'NYC / 40°45′N'}>
      <section className="demo-section" id="demo">
        <div className="studio-title">
          <div>
            <span className="section-kicker">AGENT-FIRST CANVAS · LIVE OSM</span>
            <h2>Move. Lock. Prove what changed.</h2>
          </div>
          <p>Pan anywhere. The loaded OSM tiles become an immediate geometry lock; Overpass is an optional verification upgrade, never the generation gate.</p>
        </div>
        <div className="step-strip" aria-label="MapTruth workflow"><span className={mapReady ? 'done' : ''}>01 Explore</span><span className={data.lock ? 'done' : ''}>02 Lock</span><span className={Object.values(routes).some((route) => route.status === 'ready') ? 'done' : ''}>03 Compare</span></div>
        <StatusRail />
        <div className="demo-toolbar">
          <button className="button button--primary" type="button" onClick={onLockBoundary} disabled={!mapReady || data.status === 'loading'}>
            {data.status === 'loading' ? 'Locking loaded tiles…' : data.lock ? 'Refresh live OSM lock' : 'Lock live OSM'}
          </button>
          <button className="button" type="button" onClick={() => void verifyOsmLock()} disabled={!data.lock || data.verificationStatus === 'verifying'}>{data.verificationStatus === 'verifying' ? 'Verifying in background…' : 'Verify with Overpass'}</button>
          <span className="demo-toolbar-note">Route 03 unlocks from tiles immediately. Canonical verification is optional.</span>
        </div>
        {data.error ? <div className="ai-error">{data.error}</div> : null}
        {data.verificationError ? <div className="verification-note">Overpass did not verify this lock. Live OSM geometry remains active. {data.verificationError}</div> : null}
        <div className="demo-map-stage">
          <MapStudio mode="demo" />
        </div>
        <AgentReceiptRail />
        <ComparisonGrid />
        {data.features.length ? (
          <div className="demo-verify-stage">
            <div className="panel-heading"><span>ROUTE 03 / VERIFY</span><strong>Truth seam on geometry-locked poster</strong></div>
            <TruthSeam />
          </div>
        ) : null}
      </section>
    </SiteShell>
  )
}
