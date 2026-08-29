import { useEffect, useState } from 'react'
import { SiteShell } from '../components/SiteShell'
import { StageAsk } from '../components/StageAsk'
import { StageCompare } from '../components/StageCompare'
import { AgentWalkthrough } from '../components/AgentWalkthrough'
import { AgentPanel } from '../components/AgentPanel'
import { AgentReceiptRail, StatusRail } from '../components/StudioPanels'
import { verifyOsmLock } from '../webmcp/commands'
import { resetStudioState, useAppStore } from '../state/store'
import { registerMapTruthTools } from '../webmcp/register'

type Stage = 'ask' | 'compare'

export function StudioPage() {
  const data = useAppStore((state) => state.data)
  const place = useAppStore((state) => state.place)
  const [stage, setStage] = useState<Stage>('ask')
  const [showAgent, setShowAgent] = useState(false)

  useEffect(() => {
    resetStudioState()
    let cleanup: () => void = () => undefined
    void registerMapTruthTools().then((dispose) => { cleanup = dispose })
    return () => cleanup()
  }, [])

  return (
    <SiteShell
      headerCode={data.lock ? place.name : 'MapTruth'}
      stage={stage}
      onAgent={() => setShowAgent((open) => !open)}
      agentOpen={showAgent}
    >
      {stage === 'ask'
        ? <StageAsk onGenerate={() => setStage('compare')} />
        : <StageCompare onBack={() => setStage('ask')} />}

      {showAgent ? (
        <div className="drawer" role="dialog" aria-label="Agent and provenance">
          <div className="drawer-head">
            <strong>WebMCP · 10 tools</strong>
            <button type="button" className="lightbox-close" onClick={() => setShowAgent(false)}>Close ✕</button>
          </div>
          <div className="drawer-body">
            <AgentPanel />
            <AgentWalkthrough />
            <StatusRail />
            <div className="demo-toolbar">
              <button className="button button--small" type="button" onClick={() => void verifyOsmLock()} disabled={!data.lock || data.verificationStatus === 'verifying'}>
                {data.verificationStatus === 'verifying' ? 'Checking…' : 'Double-check against OpenStreetMap'}
              </button>
              {data.lock ? <span className="demo-toolbar-note">{data.lock.featureCount.toLocaleString()} shapes · {data.lock.geometryHash}</span> : null}
            </div>
            {data.verificationError ? <div className="verification-note">Couldn’t reach OpenStreetMap just now. Your locked map is unchanged.</div> : null}
            <AgentReceiptRail />
          </div>
        </div>
      ) : null}
    </SiteShell>
  )
}
