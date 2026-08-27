import { getMapRuntime } from '../map/runtime'
import { addActivity, appStore } from '../state/store'
import { captureUndo } from '../state/history'
import type { ComparisonRoute, ToolResult } from '../types/maptruth'

const ROUTES: ComparisonRoute[] = ['promptOnly', 'screenshotGrounded']
const controllers = new Map<ComparisonRoute, AbortController>()

const routeLabel: Record<ComparisonRoute, string> = {
  promptOnly: 'Without a map',
  screenshotGrounded: 'Grounded on the real map',
}

const compactMapSummary = () => {
  const state = appStore.getState()
  return JSON.stringify({
    place: state.place.name,
    bbox: state.map.bbox.map((value) => Number(value.toFixed(5))),
    lock: state.data.lock ? {
      id: state.data.lock.id,
      kind: state.data.lock.kind,
      geometryHash: state.data.lock.geometryHash,
      featureCount: state.data.lock.featureCount,
    } : null,
    classes: Object.fromEntries(['road', 'water', 'park', 'landmark'].map((type) => [type, state.data.features.filter((feature) => feature.properties.type === type).length])),
  })
}

const setRoute = (route: ComparisonRoute, patch: Record<string, unknown>) => {
  appStore.setState((state) => ({
    ai: { ...state.ai, routes: { ...state.ai.routes, [route]: { ...state.ai.routes[route], ...patch } } },
  }))
}

export const runGenerationRoute = async (route: ComparisonRoute, source: 'manual' | 'webmcp' = 'manual'): Promise<ToolResult> => {
  const state = appStore.getState()
  const runtime = getMapRuntime()
  if (!runtime) return { status: 'needs_user_action', reason: 'map_not_ready', suggestedAction: 'wait_for_map' }
  if (route === 'screenshotGrounded' && !state.data.lock) {
    addActivity('generate_comparison', 'needs_user_action', 'The grounded image needs a locked map', { source })
    return { status: 'needs_user_action', reason: 'live_osm_lock_required', suggestedAction: 'lock_live_osm' }
  }

  let screenshot: string | undefined
  if (route !== 'promptOnly') {
    try {
      screenshot = runtime.capture()
    } catch {
      return { status: 'needs_user_action', reason: 'map_not_ready', suggestedAction: 'wait_for_map' }
    }
  }

  controllers.get(route)?.abort()
  const controller = new AbortController()
  controllers.set(route, controller)
  const startedAt = Date.now()
  captureUndo(`${routeLabel[route]} generation`)
  setRoute(route, { status: 'generating', error: undefined, startedAt, durationMs: undefined })

  try {
    const response = await fetch('/api/generate-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        route,
        prompt: appStore.getState().ai.prompt,
        sourceImageDataUrl: screenshot,
        mapSummary: route === 'screenshotGrounded' ? compactMapSummary() : undefined,
      }),
    })
    const responseText = await response.text()
    let payload: { image?: string; error?: string; detail?: string; durationMs?: number } = {}
    try {
      payload = JSON.parse(responseText) as typeof payload
    } catch {
      if (!response.ok) throw new Error(responseText.replace(/\s+/g, ' ').trim().slice(0, 180) || `Request failed (${response.status})`)
    }
    if (!response.ok || !payload.image) throw new Error(payload.detail ?? payload.error ?? `Request failed (${response.status})`)
    const durationMs = Date.now() - startedAt
    setRoute(route, { status: 'ready', imageDataUrl: payload.image, error: undefined, durationMs })
    addActivity('generate_comparison', 'ok', `${routeLabel[route]} image completed`, {
      source, durationMs, afterHash: route === 'screenshotGrounded' ? appStore.getState().data.lock?.geometryHash : undefined, reversible: true,
    })
    return { status: 'ready', route, durationMs, model: 'openai/gpt-image-2' }
  } catch (error) {
    const cancelled = controller.signal.aborted
    const message = cancelled ? 'Cancelled in this browser; the provider request may still finish server-side.' : error instanceof Error ? error.message : 'Image generation failed'
    setRoute(route, { status: cancelled ? 'cancelled' : 'error', error: message, durationMs: Date.now() - startedAt })
    addActivity('generate_comparison', cancelled ? 'needs_user_action' : 'error', `${routeLabel[route]} ${cancelled ? 'cancelled' : 'failed'}`, {
      source, durationMs: Date.now() - startedAt,
    })
    return cancelled
      ? { status: 'needs_user_action', reason: 'generation_cancelled', suggestedAction: 'retry_route' }
      : { status: 'error', reason: 'image_generation_failed', details: message }
  } finally {
    if (controllers.get(route) === controller) controllers.delete(route)
  }
}

export const generateComparisonManually = async (): Promise<ToolResult> => {
  const state = appStore.getState()
  const routes: ComparisonRoute[] = state.data.lock ? ['promptOnly', 'screenshotGrounded'] : ['promptOnly']
  appStore.setState((current) => ({
    ai: {
      ...current.ai,
      routes: Object.fromEntries(ROUTES.map((route) => [route, routes.includes(route) ? { ...current.ai.routes[route], status: 'queued', error: undefined } : current.ai.routes[route]])) as typeof current.ai.routes,
    },
  }))
  void Promise.allSettled(routes.map((route) => runGenerationRoute(route, 'manual')))
  return { status: 'ok', startedRoutes: routes, groundedRouteRequiresLock: !state.data.lock }
}

export const stageComparisonForApproval = (input: { routes?: unknown; prompt?: unknown }): ToolResult => {
  const routes = Array.isArray(input.routes)
    ? [...new Set(input.routes)].filter((route): route is ComparisonRoute => ROUTES.includes(route as ComparisonRoute))
    : ROUTES
  if (!routes.length || (Array.isArray(input.routes) && routes.length !== input.routes.length)) {
    return { status: 'error', reason: 'invalid_routes' }
  }
  if (typeof input.prompt === 'string') {
    const prompt = [...input.prompt]
      .map((character) => {
        const code = character.charCodeAt(0)
        return code < 32 || code === 127 ? ' ' : character
      })
      .join('')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 1_200)
    if (!prompt) return { status: 'error', reason: 'invalid_prompt' }
    appStore.setState((state) => ({ ai: { ...state.ai, prompt } }))
  }
  const blockedRoutes = routes.includes('screenshotGrounded') && !appStore.getState().data.lock ? ['screenshotGrounded'] as ComparisonRoute[] : []
  const runnableRoutes = routes.filter((route) => !blockedRoutes.includes(route))
  if (!runnableRoutes.length) return { status: 'needs_user_action', reason: 'live_osm_lock_required', suggestedAction: 'lock_live_osm' }
  appStore.setState((state) => ({
    ai: {
      ...state.ai,
      pendingRoutes: runnableRoutes,
      routes: Object.fromEntries(ROUTES.map((route) => [route, runnableRoutes.includes(route) ? { ...state.ai.routes[route], status: 'awaiting_approval', error: undefined } : state.ai.routes[route]])) as typeof state.ai.routes,
    },
  }))
  addActivity('generate_comparison', 'needs_user_action', `${runnableRoutes.length} GPT Image route${runnableRoutes.length === 1 ? '' : 's'} awaiting visible approval`, { source: 'webmcp' })
  return { status: 'needs_user_action', reason: 'generation_approval_required', suggestedAction: 'approve_generation_in_page', routes: runnableRoutes, blockedRoutes }
}

export const approvePendingComparison = () => {
  const routes = appStore.getState().ai.pendingRoutes ?? []
  appStore.setState((state) => ({ ai: { ...state.ai, pendingRoutes: undefined } }))
  void Promise.allSettled(routes.map((route) => runGenerationRoute(route, 'webmcp')))
}

export const cancelGeneration = (route: ComparisonRoute) => controllers.get(route)?.abort()

export const inspectComparison = (): ToolResult => {
  const state = appStore.getState()
  const routes = Object.fromEntries(ROUTES.map((route) => [route, {
    status: state.ai.routes[route].status,
    durationMs: state.ai.routes[route].durationMs,
    hasImage: Boolean(state.ai.routes[route].imageDataUrl),
    error: state.ai.routes[route].error?.slice(0, 160),
  }]))
  addActivity('inspect_comparison', 'ok', 'Returned current GPT Image route states', { source: 'webmcp' })
  return { status: 'ok', model: 'openai/gpt-image-2', routes, prompt: state.ai.prompt.slice(0, 180) }
}
