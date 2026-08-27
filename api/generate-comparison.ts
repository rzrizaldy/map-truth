import { generateRouteImage, IMAGE_MODEL_LABEL, imageGenerationError, validPngDataUrl } from './image-generation'

export const config = { maxDuration: 300 }

type ComparisonRequest = { prompt?: unknown; sourceImageDataUrl?: unknown; mapSummary?: unknown }
const json = (value: unknown, init: ResponseInit = {}) => Response.json(value, {
  ...init,
  headers: { 'Cache-Control': 'no-store', ...init.headers },
})

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 })
  let body: ComparisonRequest
  try {
    body = (await request.json()) as ComparisonRequest
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1_200) : ''
  const sourceImageDataUrl = typeof body.sourceImageDataUrl === 'string' ? body.sourceImageDataUrl : undefined
  const mapSummary = typeof body.mapSummary === 'string' ? body.mapSummary.trim().slice(0, 1_200) : ''
  if (!prompt) return json({ error: 'prompt_required' }, { status: 400 })
  if (!validPngDataUrl(sourceImageDataUrl)) return json({ error: 'valid_source_screenshot_required' }, { status: 400 })
  if (!mapSummary) return json({ error: 'map_summary_required' }, { status: 400 })

  try {
    const [promptOnly, screenshotGrounded, mapTruthGrounded] = await Promise.all([
      generateRouteImage({ route: 'promptOnly', prompt }),
      generateRouteImage({ route: 'screenshotGrounded', prompt, sourceImageDataUrl }),
      generateRouteImage({ route: 'mapTruthGrounded', prompt, sourceImageDataUrl, mapSummary }),
    ])
    return json({
      model: IMAGE_MODEL_LABEL,
      images: { promptOnly, screenshotGrounded, mapTruthArtLayer: mapTruthGrounded, mapTruthGrounded },
    })
  } catch (error) {
    return json({ error: 'image_generation_failed', detail: imageGenerationError(error) }, { status: 502 })
  }
}
