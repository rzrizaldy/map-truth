import { beforeEach, describe, expect, it, vi } from 'vitest'

const lookup = vi.hoisted(() => vi.fn())
vi.mock('./geocode', () => ({ lookupAllWithinViewport: lookup }))

const { appStore } = await import('../state/store')
const { clearNamedPlaces, resolveNamedPlaces } = await import('./namedPlaces')

const lock = {
  id: 'live:x', kind: 'live' as const, bbox: [107.55, -6.98, 107.68, -6.87] as [number, number, number, number],
  zoom: 13, sourceRevision: 'r', geometryHash: 'h', createdAt: '', featureCount: 1,
}

beforeEach(() => {
  clearNamedPlaces()
  lookup.mockReset()
  appStore.setState((state) => ({ data: { ...state.data, lock } }))
})

describe('grounding the places a model names', () => {
  it('keeps only the ones OpenStreetMap can locate, and says how many were dropped', async () => {
    lookup.mockImplementation(async (names: string[]) => names.map((query) => ({
      query,
      place: query === 'Kopi Progo' ? { label: 'Kopi Progo, Bandung', center: [107.61, -6.91] } : null,
    })))

    await resolveNamedPlaces(['Kopi Progo', 'A Cafe That Closed', 'Another Ghost'])

    const state = appStore.getState()
    expect(state.namedPlaces.map((place) => place.name)).toEqual(['Kopi Progo'])
    expect(state.namedPlacesAsked).toBe(3)
    expect(state.namedPlacesStatus).toBe('ready')
  })

  it('never invents a position for a name it could not find', async () => {
    lookup.mockResolvedValue([{ query: 'Nowhere Coffee', place: null }])
    await resolveNamedPlaces(['Nowhere Coffee'])
    expect(appStore.getState().namedPlaces).toEqual([])
    expect(appStore.getState().namedPlacesAsked).toBe(1)
  })

  it('searches inside the locked view, not the whole world', async () => {
    lookup.mockResolvedValue([{ query: 'Braga', place: null }])
    await resolveNamedPlaces(['Braga'])
    // One batched, rate-limited call rather than a burst of parallel lookups.
    expect(lookup).toHaveBeenCalledTimes(1)
    expect(lookup).toHaveBeenCalledWith(['Braga'], lock.bbox)
  })

  it('clears when the brief names nothing', async () => {
    await resolveNamedPlaces([])
    expect(appStore.getState().namedPlacesStatus).toBe('idle')
    expect(lookup).not.toHaveBeenCalled()
  })
})
