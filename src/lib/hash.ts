export const hashGeometry = async (value: unknown): Promise<string> => {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const hashGeometrySync = (value: unknown): string => {
  const text = JSON.stringify(value)
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, '0')}`
}


// Live tile features are hashed synchronously (`fnv1a:` prefix); Overpass
// features are hashed with SHA-256 server-side. Re-verify with whichever
// function produced the stored hash instead of assuming one of them.
export const geometryHashMatches = async (geometry: unknown, storedHash: string): Promise<boolean> =>
  storedHash.startsWith('fnv1a:')
    ? hashGeometrySync(geometry) === storedHash
    : (await hashGeometry(geometry)) === storedHash

/**
 * Synchronous match for tile-derived hashes.
 *
 * Returns null when the stored hash needs the async SHA-256 path, so callers
 * verifying thousands of features can stay on a plain loop instead of
 * allocating a promise per feature.
 */
export const geometryHashMatchesSync = (geometry: unknown, storedHash: string): boolean | null =>
  storedHash.startsWith('fnv1a:') ? hashGeometrySync(geometry) === storedHash : null
