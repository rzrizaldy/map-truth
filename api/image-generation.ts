import { createOpenAI } from '@ai-sdk/openai'
import { generateImage, NoImageGeneratedError, type ImageModel } from 'ai'

export const IMAGE_MODEL_LABEL = 'openai/gpt-image-2' as const
export const IMAGE_ROUTES = ['promptOnly', 'screenshotGrounded', 'mapTruthGrounded'] as const
export type ImageRoute = typeof IMAGE_ROUTES[number]

const imageModel = (): ImageModel | `${string}/${string}` =>
  process.env.OPENAI_API_KEY
    ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY }).image('gpt-image-2')
    : IMAGE_MODEL_LABEL

export type GenerateRouteInput = {
  route: ImageRoute
  prompt: string
  sourceImageDataUrl?: string
  mapSummary?: string
}

export const isImageRoute = (value: unknown): value is ImageRoute =>
  typeof value === 'string' && IMAGE_ROUTES.includes(value as ImageRoute)

export const validSourceImageDataUrl = (value: string | undefined) =>
  Boolean(value && /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/]+=*$/i.test(value) && value.length <= 3_500_000)

const promptForRoute = ({ route, prompt, sourceImageDataUrl, mapSummary }: GenerateRouteInput) => {
  if (route === 'promptOnly') {
    return `${prompt}\nCreate a complete polished 2:3 map poster from the brief alone. Make your own visual and geographic decisions.`
  }
  if (route === 'screenshotGrounded') {
    return {
      text: `${prompt}\nUse the attached live OpenStreetMap viewport as visual reference and redesign it as a polished 2:3 poster. Preserve the visible spatial relationships as closely as possible, while acknowledging this route is pixel-guided rather than geometry-locked.`,
      images: [sourceImageDataUrl!],
    }
  }
  return {
    text:
      `Generate only a non-geographic art layer for a 2:3 editorial poster. ${prompt}\n` +
      `The attached image is composition reference only. Live OSM lock context: ${mapSummary}. ` +
      'Use paper texture, ink fields, framing devices, and abstract civic-print energy. ' +
      'Do not draw roads, rivers, routes, boundaries, maps, labels, place names, landmarks, icons, coordinates, or geographic silhouettes. ' +
      'Leave the central field compositionally usable for an exact deterministic vector overlay.',
    images: [sourceImageDataUrl!],
  }
}

export const generateRouteImage = async (input: GenerateRouteInput) => {
  const result = await generateImage({
    model: imageModel(),
    prompt: promptForRoute(input),
    size: '1024x1536',
    abortSignal: AbortSignal.timeout(240_000),
  })
  return `data:${result.image.mediaType};base64,${result.image.base64}`
}

export const imageGenerationError = (error: unknown) => {
  if (NoImageGeneratedError.isInstance(error)) return 'gpt_image_returned_no_image'
  if (error && typeof error === 'object' && 'code' in error && error.code === 'moderation_blocked') return 'moderation_blocked'
  return error instanceof Error ? error.message : 'image_generation_failed'
}
