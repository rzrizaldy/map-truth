export type NamedHit = {
  query: string
  place: { name: string; center: [number, number]; osmId: string } | null
}

/** Look several suggested names up in the locked viewport, in one request. */
export const lookupNamedInViewport = async (
  names: string[],
  bbox: [number, number, number, number],
): Promise<NamedHit[]> => {
  if (!names.length) return []
  try {
    const response = await fetch('/api/osm-named', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ names, bbox }),
    })
    if (!response.headers.get('content-type')?.includes('application/json')) return []
    const payload = (await response.json()) as { results?: NamedHit[] }
    return payload.results ?? []
  } catch {
    return []
  }
}
