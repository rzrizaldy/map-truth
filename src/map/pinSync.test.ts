import { beforeEach, describe, expect, it } from 'vitest'
import { appStore } from '../state/store'
import { clearTruthPins, syncTruthPins } from './pinSync'

const lock = {
  id: 'live:x', kind: 'live' as const, bbox: [107.55, -6.98, 107.68, -6.87] as [number, number, number, number],
  zoom: 13, sourceRevision: 'r', geometryHash: 'h', createdAt: '', featureCount: 1,
}

beforeEach(() => {
  clearTruthPins()
  appStore.setState((state) => ({ data: { ...state.data, lock } }))
})

describe('the subject pin', () => {
  it('pins the chosen place and nothing the brief merely mentions', async () => {
    appStore.setState((state) => ({
      // "Cafe" here once became a pin of its own, two districts away.
      ai: { ...state.ai, prompt: 'Cafe terbaik di Bandung. 7 spot pilihan.' },
      place: { name: 'Bandung City', label: 'Bandung City, Jawa Barat', query: 'Bandung', center: [107.6, -6.92], source: 'geocoded' },
    }))
    await syncTruthPins()

    const pins = appStore.getState().truthPins
    expect(pins).toHaveLength(1)
    expect(pins[0].name).toBe('Bandung City')
    expect(pins.map((pin) => pin.name)).not.toContain('Cafe')
  })

  it('pins nothing when the place was not chosen from OpenStreetMap', async () => {
    appStore.setState(() => ({ place: { name: 'Nowhere yet', source: 'none' } }))
    await syncTruthPins()
    expect(appStore.getState().truthPins).toEqual([])
  })
})
