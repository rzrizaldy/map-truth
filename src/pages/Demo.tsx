import { useEffect, useRef } from 'react'
import { ComparisonGrid } from '../components/ComparisonGrid'
import { SiteShell } from '../components/SiteShell'
import { StatusRail } from '../components/StudioPanels'
import { TruthSeam } from '../poster/TruthSeam'
import { MapStudio } from '../map/MapStudio'
import { lockMapBoundary } from '../webmcp/commands'
import { registerMapTruthTools } from '../webmcp/register'
import { appStore, resetDemoState, useAppStore } from '../state/store'

export function DemoPage() {
  const captureRef = useRef<(() => string) | null>(null)
  const data = useAppStore((state) => state.data)
  const place = useAppStore((state) => state.place)

  useEffect(() => {
    resetDemoState()
    let cleanup: () => void = () => undefined
    registerMapTruthTools().then((dispose) => { cleanup = dispose })
    return () => cleanup()
  }, [])

  const onLockBoundary = async () => {
    appStore.setState((state) => ({ data: { ...state.data, error: undefined } }))
    const result = await lockMapBoundary()
    if (result.status === 'needs_user_action' && result.reason === 'bbox_too_large') {
      appStore.setState((state) => ({
        data: { ...state.data, status: 'idle', error: 'Zoom in closer before locking geography.' },
      }))
    }
  }

  return (
    <SiteShell headerCode={place.source === 'overpass' ? 'LOCKED' : 'NYC / 40°45′N'}>
      <section className="demo-section" id="demo">
        <div className="studio-title">
          <div>
            <span className="section-kicker">WORLDWIDE OSM · START NEW YORK</span>
            <h2>Lock the place. Compare the routes.</h2>
          </div>
          <p>Pan and zoom anywhere. Set boundary loads OpenStreetMap vectors for this view. Then generate three posters from one prompt.</p>
        </div>
        <StatusRail />
        <div className="demo-toolbar">
          <button className="button button--primary" type="button" onClick={onLockBoundary} disabled={data.status === 'loading'}>
            {data.status === 'loading' ? 'Loading OSM vectors…' : 'Set boundary'}
          </button>
          <span className="demo-toolbar-note">WebMCP tools register on this page for ChatGPT in Chrome.</span>
        </div>
        {data.error ? <div className="ai-error">{data.error}</div> : null}
        <div className="demo-map-stage">
          <MapStudio mode="demo" captureRef={captureRef} />
        </div>
        <ComparisonGrid captureRef={captureRef} />
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
