import { describe, expect, it } from 'vitest'
import { posterTitleFromPrompt } from './title'

describe('poster heading from prompt', () => {
  it('uses what the user actually asked for', () => {
    expect(posterTitleFromPrompt('Jakarta map overlay with a hypothetical NYC + NJ region based on vibes.'))
      .toBe('Jakarta map overlay hypothetical NYC')
  })

  it('stops at the first clause', () => {
    expect(posterTitleFromPrompt('Tokyo at night, neon everywhere, high contrast')).toBe('Tokyo at night')
  })

  it('strips characters that could break out of the SVG', () => {
    const title = posterTitleFromPrompt('<img src=x onerror=alert(1)> poster')
    expect(title).not.toMatch(/[<>=()]/)
  })

  it('falls back when the prompt carries no usable words', () => {
    expect(posterTitleFromPrompt('   ', 'Jakarta')).toBe('Jakarta')
  })

  it('truncates a very long clause', () => {
    expect(posterTitleFromPrompt('Amsterdam Rotterdam Utrecht Eindhoven Groningen Maastricht Delft').length)
      .toBeLessThanOrEqual(46)
  })
})
