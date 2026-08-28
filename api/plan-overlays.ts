import { createOpenAI } from '@ai-sdk/openai'
import { generateText } from 'ai'
import {
  categoryMenu,
  isOverlayCategory,
  OVERLAY_CATEGORIES,
  type OverlayCategory,
} from './_lib/overlay-categories.js'

export const config = { maxDuration: 60 }

const json = (value: unknown, init: ResponseInit = {}) => Response.json(value, {
  ...init,
  headers: { 'Cache-Control': 'no-store', ...init.headers },
})

const model = () => (process.env.OPENAI_API_KEY
  ? createOpenAI({ apiKey: process.env.OPENAI_API_KEY })('gpt-5-mini')
  : 'openai/gpt-5-mini')

/**
 * Decide which kinds of real place a brief is asking to see.
 *
 * Deliberately a closed vocabulary: the model reasons about intent and nothing
 * else. It never returns coordinates, names or queries, so it cannot smuggle an
 * invented location past the OpenStreetMap lookup that follows.
 */
export async function POST(request: Request): Promise<Response> {
  let body: { prompt?: unknown }
  try {
    body = (await request.json()) as { prompt?: unknown }
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1_200) : ''
  if (!prompt) return json({ error: 'prompt_required' }, { status: 400 })

  try {
    const { text } = await generateText({
      model: model(),
      abortSignal: AbortSignal.timeout(30_000),
      system:
        'You decide what a map should mark, given a brief.\n' +
        'Choose only from this list of categories:\n' +
        `${categoryMenu()}\n\n` +
        'Reply with a JSON array of category keys, most important first, at most four. ' +
        'Choose only what the brief genuinely asks for or clearly implies. ' +
        'If it asks for nothing markable, reply with []. ' +
        'Return the array and nothing else.',
      prompt,
    })

    const parsed: unknown = JSON.parse((text.match(/\[[\s\S]*\]/) ?? ['[]'])[0])
    const categories = (Array.isArray(parsed) ? parsed : [])
      .filter(isOverlayCategory)
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, 4) as OverlayCategory[]

    return json({
      categories: categories.map((key) => ({
        key,
        label: OVERLAY_CATEGORIES[key].label,
        colour: OVERLAY_CATEGORIES[key].colour,
      })),
    })
  } catch (error) {
    // A planning failure must never block generation; the map simply stays bare.
    return json({ categories: [], error: 'plan_failed', detail: error instanceof Error ? error.message : 'unknown' })
  }
}

export function GET(): Response {
  return json({ error: 'method_not_allowed' }, { status: 405 })
}
