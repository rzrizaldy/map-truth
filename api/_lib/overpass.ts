/**
 * Ask Overpass, falling back to a mirror.
 *
 * The main instance rate-limits and sheds load under pressure, and a single run
 * here makes several queries. A refusal from one endpoint is not evidence that
 * the data is missing, so try another before reporting nothing found.
 */
const ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.osm.jp/api/interpreter',
]

export type OverpassResult<T> =
  | { ok: true; elements: T[] }
  | { ok: false; detail: string }

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// Overpass usually answers in well under ten seconds. Waiting half a minute on
// one that has stopped answering only delays reaching a mirror that would have.
export const overpass = async <T>(query: string, timeoutMs = 14_000): Promise<OverpassResult<T>> => {
  let detail = 'overpass_unavailable'
  // Two passes over the endpoints. A public instance under load answers 429 or
  // 504 and then serves the same query happily a moment later, so giving up
  // after one try each was reporting "not found" for data that is there — it
  // failed half the time when measured.
  for (const attempt of [0, 1]) {
    for (const endpoint of ENDPOINTS) {
      if (attempt > 0) await wait(700)
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
        if (!response.ok) {
          detail = `HTTP ${response.status}`
          continue
        }
        const payload = (await response.json()) as { elements?: T[] }
        return { ok: true, elements: payload.elements ?? [] }
      } catch (error) {
        detail = error instanceof Error ? error.message : 'overpass_failed'
      }
    }
  }
  return { ok: false, detail }
}
