import { describe, expect, it } from 'vitest'
import { extractPlaceMentions, promptMatchesPlace } from './places'

describe('prompt place extraction', () => {
  it('finds the places in the demo prompt, shorthands included', () => {
    const mentions = extractPlaceMentions('Jakarta map overlay with a hypothetical NYC + NJ region based on vibes.')
    expect(mentions.map((mention) => mention.query).sort()).toEqual(['Jakarta', 'New Jersey', 'New York City'])
  })

  it('does not mistake a style adjective for a destination', () => {
    const mentions = extractPlaceMentions('A 1970s Swiss travel poster of Kyoto in autumn')
    expect(mentions[0].query).toBe('Kyoto')
    expect(mentions.map((mention) => mention.query)).not.toContain('Swiss')
  })

  it('still allows a style word that is genuinely the subject', () => {
    expect(extractPlaceMentions('A poster of Swiss mountain villages').map((m) => m.query)).toContain('Swiss')
  })

  it('puts the place the sentence points at first', () => {
    const mentions = extractPlaceMentions('Bauhaus poster of Rotterdam')
    expect(mentions[0].query).toBe('Rotterdam')
  })

  it('keeps multi-word place names together', () => {
    expect(extractPlaceMentions('A bold poster of Kuala Lumpur and San Francisco').map((m) => m.query))
      .toEqual(['Kuala Lumpur', 'San Francisco'])
  })

  it('ignores capitalised art-direction words', () => {
    expect(extractPlaceMentions('Bold editorial print in Black and Cream. Minimal labels.')).toEqual([])
  })

  it('ignores a sentence-leading verb', () => {
    expect(extractPlaceMentions('Create a minimal map poster').map((m) => m.query)).toEqual([])
  })

  it('flags a prompt whose places do not match the locked viewport', () => {
    const mentions = extractPlaceMentions('Jakarta map overlay based on vibes')
    expect(promptMatchesPlace(mentions, 'Manhattan, New York County, New York')).toBe(false)
    expect(promptMatchesPlace(mentions, 'Menteng, Central Jakarta, Indonesia')).toBe(true)
  })

  it('never blocks a prompt that names no place', () => {
    expect(promptMatchesPlace([], 'Anywhere')).toBe(true)
  })
})

describe('matching a place the geocoder named in another language', () => {
  it('accepts the name the user asked for even when the label is local', () => {
    const mentions = extractPlaceMentions('A 1970s Swiss travel poster of Kyoto in autumn')
    expect(promptMatchesPlace(mentions, '京都市', '京都市, 京都府, 日本', 'Kyoto')).toBe(true)
  })

  it('still catches a genuine mismatch', () => {
    const mentions = extractPlaceMentions('A poster of Kyoto in autumn')
    expect(promptMatchesPlace(mentions, 'Manhattan', 'Manhattan, New York', undefined)).toBe(false)
  })

  it('matches when any one of several mentioned places is the locked one', () => {
    const mentions = extractPlaceMentions('Swiss style poster of Kyoto')
    expect(promptMatchesPlace(mentions, 'Kyoto', 'Kyoto, Japan', 'Kyoto')).toBe(true)
  })
})

describe('disambiguating short acronyms', () => {
  it('qualifies an acronym with the place named after it', () => {
    const mentions = extractPlaceMentions('Peta demo DPR Jakarta')
    expect(mentions.map((m) => [m.text, m.query])).toEqual([['DPR', 'DPR Jakarta'], ['Jakarta', 'Jakarta']])
  })

  it('leaves full place names alone', () => {
    expect(extractPlaceMentions('A poster of Kyoto and Osaka').map((m) => m.query))
      .toEqual(['Kyoto', 'Osaka'])
  })

  it('does not qualify an acronym that is already last', () => {
    expect(extractPlaceMentions('Jakarta DPR').map((m) => m.query)).toEqual(['Jakarta', 'DPR'])
  })
})

describe('prompts about safety-critical maps', () => {
  it('does not offer to fly the map to a noun', () => {
    const mentions = extractPlaceMentions('Protest safety map — DPR Jakarta. Show gathering points and medical posts.')
    expect(mentions.map((mention) => mention.text)).toEqual(['DPR', 'Jakarta'])
  })

  it('handles an evacuation brief the same way', () => {
    const mentions = extractPlaceMentions('Flood evacuation route map for Semarang')
    expect(mentions.map((mention) => mention.text)).toEqual(['Semarang'])
  })

  it('still finds a place that genuinely leads the sentence', () => {
    expect(extractPlaceMentions('Semarang flood evacuation map').map((m) => m.text)).toEqual(['Semarang'])
  })
})
