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

describe('the focused place is the subject', () => {
  it('is pinned even though it is also the map centre', async () => {
    // Regression: asking for the DPR building centred on it and then left it
    // unmarked, because it read as "the place we are already on".
    const { syncTruthPins } = await import('./pinSync')
    const { appStore } = await import('../state/store')
    appStore.setState({
      place: {
        name: 'Dewan Perwakilan Rakyat', label: 'Dewan Perwakilan Rakyat, Jakarta',
        query: 'DPR Jakarta', center: [106.80029, -6.2102083], source: 'geocoded',
      },
      ai: { ...appStore.getState().ai, prompt: 'Peta demo DPR Jakarta' },
      data: {
        status: 'ready', features: [], verificationStatus: 'idle',
        lock: {
          id: 'live:x', kind: 'live', bbox, zoom: 14,
          sourceRevision: 'r', geometryHash: 'h', createdAt: '', featureCount: 0,
        },
      },
      truthPins: [],
    })
    await syncTruthPins()
    const pins = appStore.getState().truthPins
    expect(pins.map((pin) => pin.name)).toContain('Dewan Perwakilan Rakyat')
    expect(pins[0].center).toEqual([106.80029, -6.2102083])
  })
})
