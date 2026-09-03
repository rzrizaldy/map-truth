import { focusPlace, getMapContext, lockLiveOsm, markFromOsm, verifyGeography } from './commands'
import { stageComparisonForApproval } from '../ai/generation'
import { addActivity, appStore } from '../state/store'
import type { ToolResult } from '../types/maptruth'

export type WalkthroughStep = {
  tool: string
  detail: string
  input: Record<string, unknown>
  run: () => Promise<ToolResult> | ToolResult
}

/**
 * A visible six-step path through the same functions WebMCP exposes, driven in
 * the order an assistant would call them. The page registers ten tools in all;
 * this walkthrough uses only the ones needed to reach the cost approval gate.
 *
 * Production Chrome only exposes `document.modelContext` behind a flag or an
 * origin trial, so without this there is no way to *see* the agent path. This
 * is not a simulation of the tools — it calls the real ones and leaves the same
 * receipts, and it stops at the same cost gate a real agent hits.
 */
export const walkthroughSteps = (place: string): WalkthroughStep[] => [
  {
    tool: 'focus_place',
    detail: `Find ${place} and lock its real geometry`,
    input: { place },
    run: () => focusPlace({ place }),
  },
  {
    tool: 'inspect_map_context',
    detail: 'Read back what is actually on the map',
    input: { detail: 'features' },
    run: () => getMapContext({ detail: 'features' }),
  },
  {
    tool: 'lock_live_osm',
    detail: 'Re-lock so the geometry hash is current',
    input: {},
    run: () => lockLiveOsm('webmcp'),
  },
  {
    tool: 'mark_from_osm',
    detail: 'Decide what this brief needs, then mark the real ones',
    input: {},
    run: () => markFromOsm(),
  },
  {
    tool: 'verify_geography',
    detail: 'Re-hash every locked shape against its source',
    input: {},
    run: () => verifyGeography(),
  },
  {
    tool: 'generate_comparison',
    detail: 'Stage the images — and stop for human approval',
    input: { routes: ['promptOnly', 'screenshotGrounded'] },
    run: () => stageComparisonForApproval({ routes: ['promptOnly', 'screenshotGrounded'] }),
  },
]

export const runWalkthroughStep = async (step: WalkthroughStep) => {
  const modelContext = document.modelContext as typeof document.modelContext & {
    executeTool?: (tool: unknown, input: string) => Promise<unknown>
  }
  if (modelContext && typeof modelContext.getTools === 'function' && typeof modelContext.executeTool === 'function') {
    const tools = await modelContext.getTools()
    const registered = tools.find((tool) => tool.name === step.tool)
    if (registered) {
      const raw = await modelContext.executeTool(registered, JSON.stringify(step.input))
      return (typeof raw === 'string' ? JSON.parse(raw) : raw) as ToolResult
    }
  }
  const result = await step.run()
  return result
}

export const announceWalkthrough = (place: string) => {
  addActivity('agent_walkthrough', 'ok', `Assistant walkthrough started for ${place}`, { source: 'webmcp' })
  appStore.setState((state) => ({ ui: { ...state.ui, selectedReceiptId: undefined } }))
}
