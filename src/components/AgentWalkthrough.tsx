import { useState } from 'react'
import { extractPlaceMentions } from '../map/places'
import { walkthroughSteps, announceWalkthrough, type WalkthroughStep } from '../webmcp/walkthrough'
import { useAppStore } from '../state/store'
import type { ToolResult } from '../types/maptruth'

type StepState = { status: 'idle' | 'running' | 'done' | 'blocked'; result?: ToolResult }

const summarise = (tool: string, result?: ToolResult): string => {
  if (!result) return ''
  const value = result as Record<string, unknown>
  if (tool === 'focus_place') return `${result.status} · ${String(value.place ?? '')}`
  if (tool === 'inspect_map_context') return `${Number(value.featureCount ?? 0)} features in context`
  if (tool === 'lock_live_osm') return `${Number(value.featureCount ?? 0)} shapes · ${String(value.geometryHash ?? '').slice(0, 14)}`
  if (tool === 'verify_geography') {
    return result.status === 'verified'
      ? `${Number(value.checkedFeatureCount ?? 0).toLocaleString()} shapes match their source`
      : `${result.status}${value.reason ? ` · ${String(value.reason)}` : ''}`
  }
  if (tool === 'generate_comparison') return 'stopped for your approval'
  return String(result.status)
}

export function AgentWalkthrough() {
  const prompt = useAppStore((state) => state.ai.prompt)
  const mapReady = useAppStore((state) => state.ui.mapReady)
  const webmcpAvailable = useAppStore((state) => state.ui.webmcpAvailable)
  const [steps, setSteps] = useState<Array<{ step: WalkthroughStep } & StepState>>([])
  const [running, setRunning] = useState(false)

  const place = extractPlaceMentions(prompt)[0]?.query ?? 'Kyoto'

  const run = async () => {
    const plan = walkthroughSteps(place)
    setRunning(true)
    setSteps(plan.map((step) => ({ step, status: 'idle' as const })))
    announceWalkthrough(place)

    for (let index = 0; index < plan.length; index += 1) {
      setSteps((current) => current.map((entry, i) => (i === index ? { ...entry, status: 'running' } : entry)))
      let result: ToolResult
      try {
        result = await plan[index].run()
      } catch (error) {
        // A throwing tool used to leave the walkthrough spinning forever with
        // nothing on screen to say why.
        result = { status: 'error', reason: 'tool_threw', details: String(error) }
      }
      const blocked = result.status !== 'ok' && result.status !== 'verified' && result.status !== 'ready'
        && plan[index].tool !== 'generate_comparison'
      setSteps((current) => current.map((entry, i) => (
        i === index ? { ...entry, status: blocked ? 'blocked' : 'done', result } : entry)))
      if (blocked) break
    }
    setRunning(false)
  }

  return (
    <div className="agent-demo">
      <div className="agent-demo-head">
        <div>
          <span>WEBMCP</span>
          <strong>Watch an assistant do it</strong>
        </div>
        <button className="button button--small" type="button" onClick={() => void run()} disabled={!mapReady || running}>
          {running ? 'Running…' : `Run the agent on ${place}`}
        </button>
      </div>
      <p className="agent-demo-note">
        {webmcpAvailable
          ? 'This browser exposes WebMCP, so an assistant can call these nine tools directly. The button runs the same functions so you can watch them.'
          : 'This browser has no WebMCP, so nothing can call the tools from outside. The button runs the very same nine functions an assistant would — real calls, real receipts, and it still stops at the approval gate.'}
      </p>
      {steps.length ? (
        <ol className="agent-steps">
          {steps.map(({ step, status, result }) => (
            <li key={step.tool} className={`agent-step agent-step--${status}`}>
              <code>{step.tool}</code>
              <span className="agent-step-detail">{step.detail}</span>
              <span className="agent-step-result">
                {status === 'running' ? 'calling…' : status === 'idle' ? '' : summarise(step.tool, result)}
              </span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  )
}
