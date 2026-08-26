import { createOpenAI } from '@ai-sdk/openai'
import { generateImage, NoImageGeneratedError, type ImageModel } from 'ai'

export const config = { maxDuration: 300 }

const IMAGE_MODEL_ID = 'gpt-image-2' as const

const imageModel = (): ImageModel | `${string}/${string}` =>
  process.env.OPENAI_API_KEY
    ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).image(IMAGE_MODEL_ID)
    : 'openai/gpt-image-2'

type ComparisonRequest = {
  prompt?: unknown
  sourceImageDataUrl?: unknown
  mapSummary?: unknown
}

const json = (value: unknown, init: ResponseInit = {}) =>
  Response.json(value, {
    ...init,
    headers: { 'Cache-Control': 'no-store', ...init.headers },
  })

const imageDataUrl = (image: { mediaType: string; base64: string }) =>
  `data:${image.mediaType};base64,${image.base64}`

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'method_not_allowed' }, { status: 405 })

  let body: ComparisonRequest
  try {
    body = (await request.json()) as ComparisonRequest
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }

  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1_200) : ''
  const sourceImage = typeof body.sourceImageDataUrl === 'string' ? body.sourceImageDataUrl : ''
  const mapSummary = typeof body.mapSummary === 'string' ? body.mapSummary.trim().slice(0, 800) : ''
  if (!prompt) return json({ error: 'prompt_required' }, { status: 400 })
  if (!sourceImage.startsWith('data:image/png;base64,') || sourceImage.length > 10_000_000) {
    return json({ error: 'valid_source_screenshot_required' }, { status: 400 })
  }

  try {
    const model = imageModel()
    const [promptOnly, screenshotGrounded, mapTruthArtLayer] = await Promise.all([
      generateImage({
        model,
        prompt: `${prompt}\nCreate a complete polished map poster from the prompt alone.`,
        size: '1024x1536',
        abortSignal: AbortSignal.timeout(240_000),
      }),
      generateImage({
        model,
        prompt: {
          text: `${prompt}\nUse the attached source-map screenshot as visual reference and redesign it as a polished poster.`,
          images: [sourceImage],
        },
        size: '1024x1536',
        abortSignal: AbortSignal.timeout(240_000),
      }),
      generateImage({
        model,
        prompt:
          `Generate only a non-geographic art layer for a 2:3 editorial poster. ${prompt}\n` +
          `Context: ${mapSummary}. Use paper texture, ink fields, framing devices, and abstract civic-print energy. ` +
          'Do not draw roads, rivers, routes, boundaries, maps, labels, place names, landmarks, icons, or coordinates. Leave the center compositionally usable for an exact map overlay.',
        size: '1024x1536',
        abortSignal: AbortSignal.timeout(240_000),
      }),
    ])

    return json({
      model: 'openai/gpt-image-2',
      images: {
        promptOnly: imageDataUrl(promptOnly.image),
        screenshotGrounded: imageDataUrl(screenshotGrounded.image),
        mapTruthArtLayer: imageDataUrl(mapTruthArtLayer.image),
      },
    })
  } catch (error) {
    const detail = NoImageGeneratedError.isInstance(error)
      ? 'gpt_image_returned_no_image'
      : error instanceof Error
        ? error.message
        : 'image_generation_failed'
    return json({ error: 'image_generation_failed', detail }, { status: 502 })
  }
}

