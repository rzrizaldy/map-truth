import {
  generateRouteImage,
  IMAGE_MODEL_LABEL,
  imageGenerationError,
  isImageRoute,
  validSourceImageDataUrl,
} from './image-generation.js'

export const config = { maxDuration: 300 }

type RouteRequest = {
  route?: unknown
  prompt?: unknown
  sourceImageDataUrl?: unknown
  mapSummary?: unknown
}

const json = (value: unknown, init: ResponseInit = {}) => Response.json(value, {
  ...init,
  headers: { 'Cache-Control': 'no-store', ...init.headers },
})

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 })
  let body: RouteRequest
  try {
    body = (await request.json()) as RouteRequest
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }

  if (!isImageRoute(body.route)) return json({ error: 'invalid_route' }, { status: 400 })
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1_200) : ''
  const sourceImageDataUrl = typeof body.sourceImageDataUrl === 'string' ? body.sourceImageDataUrl : undefined
  const mapSummary = typeof body.mapSummary === 'string' ? body.mapSummary.trim().slice(0, 1_200) : undefined
  if (!prompt) return json({ error: 'prompt_required' }, { status: 400 })
  if (body.route !== 'promptOnly' && !validSourceImageDataUrl(sourceImageDataUrl)) {
    return json({ error: 'valid_source_screenshot_required' }, { status: 400 })
  }
  if (body.route === 'mapTruthGrounded' && !mapSummary) {
    return json({ error: 'map_summary_required' }, { status: 400 })
  }

  const startedAt = Date.now()
  try {
    const image = await generateRouteImage({ route: body.route, prompt, sourceImageDataUrl, mapSummary })
    return json({ route: body.route, model: IMAGE_MODEL_LABEL, image, durationMs: Date.now() - startedAt })
  } catch (error) {
    const detail = imageGenerationError(error)
    return json({ error: detail === 'moderation_blocked' ? 'moderation_blocked' : 'image_generation_failed', detail }, { status: detail === 'moderation_blocked' ? 400 : 502 })
  }
}
