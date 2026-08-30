/**
 * Ask Overpass, reaching for a mirror when the first one is slow.
 *
 * Trying each endpoint in turn meant a server that had stopped answering cost
 * its whole timeout before anything else was attempted — measured at forty
 * seconds on a query that a mirror served in six. Requests are staggered
 * instead: the next endpoint joins in only if the one before it has not
 * answered yet, so the common case costs one request and the slow case is
 * decided by whoever is fastest rather than by whoever was asked first.
 */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
]

/** How long to give an endpoint alone before letting the next one join. */
const HEDGE_MS = 3_500

export type OverpassResult<T> =
  | { ok: true; elements: T[] }
  | { ok: false; detail: string }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

const ask = async <T>(endpoint: string, query: string, timeoutMs: number): Promise<OverpassResult<T>> => {
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'MapTruth/1.0 (https://map-truth.vercel.app)',
      },
      body: `data=${encodeURIComponent(query)}`,
      signal: AbortSignal.timeout(timeoutMs),
    })
    if (!response.ok) return { ok: false, detail: `HTTP ${response.status}` }
    const payload = (await response.json()) as { elements?: T[] }
    return { ok: true, elements: payload.elements ?? [] }
  } catch (error) {
    return { ok: false, detail: error instanceof Error ? error.message : 'overpass_failed' }
  }
}

export const overpass = async <T>(query: string, timeoutMs = 14_000): Promise<OverpassResult<T>> => {
  let detail = 'overpass_unavailable'

  const round = async () => {
    const race = ENDPOINTS.map((endpoint, index) => (async () => {
      if (index) await wait(index * HEDGE_MS)
      const result = await ask<T>(endpoint, query, timeoutMs)
      if (!result.ok) {
        detail = result.detail
        // Rejecting lets Promise.any move on to whichever endpoint does answer.
        throw new Error(result.detail)
      }
      return result
    })())
    try {
      return await Promise.any(race)
    } catch {
      return null
    }
  }

  // Hedging alone dropped success from ten runs in ten to six: when every
  // endpoint is shedding load at once, one shot each is not enough. A second
  // round costs nothing in the common case, because the first one answered.
  const first = await round()
  if (first) return first
  await wait(1_500)
  return (await round()) ?? { ok: false, detail }
}
