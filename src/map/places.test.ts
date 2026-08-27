import { describe, expect, it } from 'vitest'
import { extractPlaceMentions, promptMatchesPlace } from './places'

describe('prompt place extraction', () => {
  it('finds the places in the demo prompt, shorthands included', () => {
    const mentions = extractPlaceMentions('Jakarta map overlay with a hypothetical NYC + NJ region based on vibes.')
    expect(mentions.map((mention) => mention.query)).toEqual(['Jakarta', 'New York City', 'New Jersey'])
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
