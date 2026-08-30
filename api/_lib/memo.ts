/**
 * Remember an answer for a short while, per function instance.
 *
 * Overpass is the slow, rate-limited part of every request, and a demo asks
 * for the same place repeatedly. Fluid Compute reuses instances, so a plain map
 * turns the second ask into an instant one — and one fewer query for a public
 * server that is already refusing under load.
 *
 * Deliberately per-instance and short-lived: this is a latency cushion, never a
 * source of truth, and OpenStreetMap edits should show up in minutes.
 */
const TTL_MS = 10 * 60 * 1000
const MAX_ENTRIES = 200

const store = new Map<string, { at: number; value: unknown }>()

/**
 * `keep` decides what is worth remembering. A refusal or an empty answer must
 * not be stored, or one bad moment poisons the next ten minutes.
 */
export const memo = async <T>(key: string, produce: () => Promise<T>, keep: (value: T) => boolean): Promise<T> => {
  const hit = store.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value as T

  const value = await produce()
  if (!keep(value)) return value
  store.set(key, { at: Date.now(), value })

  // Cheapest possible eviction: drop the oldest insertion when it grows.
  if (store.size > MAX_ENTRIES) {
    const oldest = store.keys().next().value
    if (oldest !== undefined) store.delete(oldest)
  }
  return value
}
