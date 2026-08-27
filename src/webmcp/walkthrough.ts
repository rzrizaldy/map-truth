import { focusPlace, getMapContext, lockLiveOsm, verifyGeography } from './commands'
import { stageComparisonForApproval } from '../ai/generation'
import { addActivity, appStore } from '../state/store'
import type { ToolResult } from '../types/maptruth'

export type WalkthroughStep = {
  tool: string
  detail: string
  run: () => Promise<ToolResult> | ToolResult
}

/**
 * The same nine functions WebMCP exposes, driven in the order an assistant
 * would call them.
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
    run: () => focusPlace({ place }),
  },
  {
    tool: 'inspect_map_context',
    detail: 'Read back what is actually on the map',
    run: () => getMapContext({ detail: 'features' }),
  },
  {
    tool: 'lock_live_osm',
    detail: 'Re-lock so the geometry hash is current',
    run: () => lockLiveOsm('webmcp'),
  },
  {
    tool: 'verify_geography',
    detail: 'Re-hash every drawn shape against its source',
    run: () => verifyGeography(),
  },
  {
    tool: 'generate_comparison',
    detail: 'Stage the images — and stop for human approval',
    run: () => stageComparisonForApproval({ routes: ['promptOnly', 'screenshotGrounded', 'mapTruthGrounded'] }),
  },
]

export const runWalkthroughStep = async (step: WalkthroughStep) => {
  const result = await step.run()
  return result
}

export const announceWalkthrough = (place: string) => {
  addActivity('agent_walkthrough', 'ok', `Assistant walkthrough started for ${place}`, { source: 'webmcp' })
  appStore.setState((state) => ({ ui: { ...state.ui, selectedReceiptId: undefined } }))
}
