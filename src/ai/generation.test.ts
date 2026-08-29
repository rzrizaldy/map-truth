import { afterEach, describe, expect, it } from 'vitest'
import { generationRequestPayload, visibleMarkerCount } from './generation'
import { appStore, resetStudioState } from '../state/store'

afterEach(() => resetStudioState())

describe('grounded image request evidence', () => {
  it('counts every marker layer visible in the captured map', () => {
    const state = {
      truthPins: [{}],
      overlays: [{}, {}],
      namedPlaces: [{}, {}, {}],
    }
    expect(visibleMarkerCount(state as never)).toBe(6)
  })

  it('forwards that count only to the grounded route', () => {
    appStore.setState({
      truthPins: [{} as never],
      overlays: [{} as never, {} as never],
      namedPlaces: [{} as never],
    })

    expect(generationRequestPayload('screenshotGrounded', 'data:image/png;base64,map'))
      .toMatchObject({ markerCount: 4, sourceImageDataUrl: 'data:image/png;base64,map' })
    expect(generationRequestPayload('promptOnly')).toMatchObject({ markerCount: 0 })
  })
})
