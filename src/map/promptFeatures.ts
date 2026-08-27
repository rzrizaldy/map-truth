import type { SourceFeature } from '../types/maptruth'

// Words that appear in almost every brief and would match half a city.
const NOISE = new Set([
  'a', 'an', 'the', 'of', 'in', 'at', 'on', 'to', 'from', 'and', 'or', 'with', 'for',
  'map', 'maps', 'poster', 'print', 'art', 'style', 'styled', 'vintage', 'retro', 'modern',
  'city', 'town', 'area', 'region', 'district', 'street', 'streets', 'road', 'roads',
  'demo', 'peta', 'kota', 'jalan', 'di', 'dan', 'yang', 'untuk',
  'create', 'make', 'draw', 'show', 'generate', 'render', 'bold', 'minimal', 'clean',
  'sunset', 'sunrise', 'night', 'day', 'autumn', 'winter', 'summer', 'spring',
])

export type PromptMatch = { feature: SourceFeature; term: string }

const terms = (prompt: string) =>
  prompt
    .replace(/[^\p{L}\p{N}\s/-]/gu, ' ')
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 3 && !NOISE.has(word.toLowerCase()))

/**
 * Find real, source-backed features the prompt is actually asking about.
 *
 * This is the difference between "a poster of Jakarta" and "a poster of the DPR
 * building": the second names a thing that exists at a known coordinate, and
 * MapTruth can point at the real one instead of letting the model guess. Only
 * features already in the lock are eligible, so a match is always provable.
 */
export const matchPromptFeatures = (
  prompt: string,
  features: SourceFeature[],
  limit = 6,
): PromptMatch[] => {
  const wanted = terms(prompt)
  if (!wanted.length) return []

  const matches: PromptMatch[] = []
  const seen = new Set<string>()

  for (const feature of features) {
    const name = feature.properties.name
    if (!name) continue
    const haystack = name.toLowerCase()
    const term = wanted.find((word) => {
      const needle = word.toLowerCase()
      // Whole-word or slash-separated match ("DPR" in "Gedung DPR/MPR RI"),
      // never a substring that happens to appear inside a longer word.
      return new RegExp(`(^|[^\\p{L}\\p{N}])${needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^\\p{L}\\p{N}]|$)`, 'iu').test(haystack)
    })
    if (!term || seen.has(name.toLowerCase())) continue
    seen.add(name.toLowerCase())
    matches.push({ feature, term })
    if (matches.length >= limit) break
  }

  // Landmarks pin better than a road segment carrying the same name.
  return matches.sort((a, b) => {
    const rank = (match: PromptMatch) => (match.feature.properties.type === 'landmark' ? 0 : 1)
    return rank(a) - rank(b)
  })
}
