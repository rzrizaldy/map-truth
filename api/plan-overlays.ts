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
  let body: { prompt?: unknown; place?: unknown }
  try {
    body = (await request.json()) as { prompt?: unknown; place?: unknown }
  } catch {
    return json({ error: 'invalid_json' }, { status: 400 })
  }
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim().slice(0, 1_200) : ''
  const place = typeof body.place === 'string' ? body.place.trim().slice(0, 160) : ''
  if (!prompt) return json({ error: 'prompt_required' }, { status: 400 })

  try {
    const { text } = await generateText({
      model: model(),
      abortSignal: AbortSignal.timeout(30_000),
      system:
        'You decide what a map should mark, given a brief about a place.\n\n' +
        'Reply with JSON only, shaped {"categories": [...], "places": [...]}.\n\n' +
        'categories — at most four keys, most important first, chosen only from:\n' +
        `${categoryMenu()}\n` +
        'Pick only what the brief genuinely asks for or clearly implies; [] if nothing fits.\n\n' +
        'places — if the brief asks for the best, the most famous, the most iconic, or a ' +
        'numbered pick of anything ("7 spot pilihan", "top cafes", "must-see landmarks"), ' +
        'then name the specific real ones you know in this area, up to eight, written the ' +
        'way they are commonly signed or listed locally. This is the part you are for: ' +
        'OpenStreetMap can say what exists but not what is famous, so if you know the area ' +
        'at all, name them. Every name is looked up in OpenStreetMap and dropped if it is ' +
        'not there, so a wrong guess costs nothing and an omission costs the whole answer. ' +
        'Return [] only when the brief asks for a kind of place in general rather than ' +
        'particular ones.',
      prompt: place ? `${prompt}\n\nThe map is centred on: ${place}` : prompt,
    })

    const parsed = JSON.parse((text.match(/\{[\s\S]*\}/) ?? ['{}'])[0]) as {
      categories?: unknown
      places?: unknown
    }
    const categories = (Array.isArray(parsed.categories) ? parsed.categories : [])
      .filter(isOverlayCategory)
      .filter((value, index, all) => all.indexOf(value) === index)
      .slice(0, 4) as OverlayCategory[]

    // Names only. Nothing here is trusted as a location until OpenStreetMap
    // says where it is, so no coordinate can enter the map through the model.
    const places = (Array.isArray(parsed.places) ? parsed.places : [])
      .filter((value): value is string => typeof value === 'string')
      .map((value) => value.replace(/\s+/g, ' ').trim().slice(0, 80))
      .filter((value, index, all) => value.length > 1 && all.indexOf(value) === index)
      .slice(0, 8)

    return json({
      categories: categories.map((key) => ({
        key,
        label: OVERLAY_CATEGORIES[key].label,
        colour: OVERLAY_CATEGORIES[key].colour,
      })),
      places,
    })
  } catch (error) {
    // A planning failure must never block generation; the map simply stays bare.
    return json({ categories: [], places: [], error: 'plan_failed', detail: error instanceof Error ? error.message : 'unknown' })
  }
}

export function GET(): Response {
  return json({ error: 'method_not_allowed' }, { status: 405 })
}
