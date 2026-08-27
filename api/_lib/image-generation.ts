import { createOpenAI } from '@ai-sdk/openai'
import { generateImage, NoImageGeneratedError, type ImageModel } from 'ai'

export const IMAGE_MODEL_LABEL = 'openai/gpt-image-2' as const
export const IMAGE_ROUTES = ['promptOnly', 'screenshotGrounded'] as const
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
  return {
    text:
      `${prompt}\n` +
      'The attached image is a real OpenStreetMap view of the exact place this brief is about, ' +
      `captured live${mapSummary ? ` (${mapSummary})` : ''}. ` +
      'Redraw it as a polished 2:3 poster. Follow the real street layout, coastlines, waterways and ' +
      'green space as closely as you can, and keep every marker exactly where it sits on the attached map. ' +
      'Do not invent streets, districts or landmarks that are not visible in it.',
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
