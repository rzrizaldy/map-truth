import { describe, expect, it, vi } from 'vitest'
import { pinnableTerms, resolveTruthPins } from './truthPins'

const bbox: [number, number, number, number] = [106.78, -6.23, 106.82, -6.19]

describe('choosing what to pin', () => {
  it('drops the place the map is already on', () => {
    expect(pinnableTerms('Peta demo DPR Jakarta', ['Jakarta', 'Jakarta, Indonesia'])
      .map((mention) => [mention.text, mention.query])).toEqual([['DPR', 'DPR Jakarta']])
  })

  it('returns nothing when the prompt names only the current place', () => {
    expect(pinnableTerms('A poster of Jakarta at sunset', ['Jakarta'])).toEqual([])
  })
})

describe('resolving pins against OpenStreetMap', () => {
  const place = (name: string, center: [number, number]) => ({
    name, label: `${name}, Jakarta`, center, bbox, zoom: 14, kind: 'building',
  })

  it('pins a real building the prompt names', async () => {
    const lookup = vi.fn().mockResolvedValue(place('Gedung DPR/MPR RI', [106.8005, -6.2107]))
    const pins = await resolveTruthPins('Peta demo DPR Jakarta', ['Jakarta'], bbox, lookup)
    expect(pins).toEqual([{ term: 'DPR', name: 'Gedung DPR/MPR RI', label: 'Gedung DPR/MPR RI, Jakarta', center: [106.8005, -6.2107] }])
    // The qualifier travels with the lookup so it cannot land in another city.
    expect(lookup).toHaveBeenCalledWith('DPR Jakarta', bbox)
  })

  it('discards a hit that falls outside the locked viewport', async () => {
    const lookup = vi.fn().mockResolvedValue(place('DPR somewhere else', [120, 20]))
    expect(await resolveTruthPins('demo DPR Jakarta', ['Jakarta'], bbox, lookup)).toEqual([])
  })

  it('is silent when the term matches nothing real', async () => {
    const lookup = vi.fn().mockResolvedValue(null)
    expect(await resolveTruthPins('demo DPR Jakarta', ['Jakarta'], bbox, lookup)).toEqual([])
  })
})
