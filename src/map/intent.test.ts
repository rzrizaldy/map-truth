import { beforeEach } from 'vitest'
import { describe, expect, it, vi } from 'vitest'

const geocode = vi.hoisted(() => vi.fn())
vi.mock('./geocode', () => ({ geocodePlace: geocode }))
vi.mock('./overlays', () => ({}))

const { readIntent } = await import('./intent')

const place = (name: string) => ({
  ok: true as const,
  place: { name, label: `${name}, somewhere`, center: [0, 0] as [number, number], bbox: [0, 0, 1, 1] as [number, number, number, number], zoom: 13, kind: 'city' },
})
const missing = { ok: false as const, reason: 'not_found' as const }

beforeEach(() => {
  geocode.mockReset()
  global.fetch = vi.fn().mockResolvedValue({
    headers: { get: () => 'application/json' },
    json: async () => ({ categories: [] }),
  }) as never
})

describe('reading a brief', () => {
  it('falls back to the bare term when the qualified query misses', async () => {
    // "DPR Tandai" is what a stopword gap produces; "DPR" still has to work.
    geocode.mockImplementation(async (query: string) =>
      (query === 'DPR Jakarta' ? missing : place('Dewan Perwakilan Rakyat')))

    const intent = await readIntent('Peta demo DPR Jakarta')
    expect(intent.status).toBe('ready')
    expect(intent.query).toBe('DPR')
    expect(geocode).toHaveBeenCalledWith('DPR Jakarta')
    expect(geocode).toHaveBeenCalledWith('DPR')
  })

  it('reports no place when neither form resolves', async () => {
    geocode.mockResolvedValue(missing)
    const intent = await readIntent('Peta demo DPR Jakarta')
    expect(intent.status).toBe('no_place')
    expect(intent.term).toBe('DPR')
  })

  it('says so when the brief names nowhere at all', async () => {
    const intent = await readIntent('A bold colourful poster')
    expect(intent.status).toBe('no_place')
    expect(intent.term).toBeUndefined()
    expect(geocode).not.toHaveBeenCalled()
  })
})
