import { beforeEach, describe, expect, it, vi } from 'vitest'
import { appStore } from '../state/store'
import { clearOverlays, syncOverlays } from './overlays'

const lock = {
  id: 'live:x', kind: 'live' as const, bbox: [106.79, -6.22, 106.81, -6.2] as [number, number, number, number],
  zoom: 14, sourceRevision: 'r', geometryHash: 'h', createdAt: '', featureCount: 1,
}

const jsonResponse = (body: unknown) => ({
  headers: { get: () => 'application/json' },
  json: async () => body,
})

beforeEach(() => {
  clearOverlays()
  appStore.setState((state) => ({ data: { ...state.data, lock }, ai: { ...state.ai, prompt: 'medical posts near DPR' } }))
})

describe('marking the map', () => {
  it('does not re-plan when the read-back already did', async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ markers: [] }))
    global.fetch = fetchMock as never

    await syncOverlays([{ key: 'medical', label: 'Medical', colour: '#ea4335' }])

    const called = fetchMock.mock.calls.map((call) => String(call[0]))
    expect(called).toEqual(['/api/osm-overlays'])
    expect(called).not.toContain('/api/plan-overlays')
  })

  it('plans for itself when nobody handed it a plan', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ categories: [{ key: 'medical', label: 'Medical', colour: '#ea4335' }] }))
      .mockResolvedValueOnce(jsonResponse({ markers: [] }))
    global.fetch = fetchMock as never

    await syncOverlays()

    expect(fetchMock.mock.calls.map((call) => String(call[0])))
      .toEqual(['/api/plan-overlays', '/api/osm-overlays'])
  })

  it('leaves the map bare when the brief asks for nothing markable', async () => {
    global.fetch = vi.fn().mockResolvedValue(jsonResponse({ categories: [] })) as never
    await syncOverlays()
    expect(appStore.getState().overlays).toEqual([])
    expect(appStore.getState().overlayStatus).toBe('idle')
  })
})
