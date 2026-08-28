import { describe, expect, it } from 'vitest'
import { OVERLAY_CATEGORIES, categoryMenu, isOverlayCategory } from './_lib/overlay-categories'

describe('the overlay vocabulary', () => {
  it('rejects anything outside the closed list', () => {
    // The model picks categories; it must never be able to smuggle a query in.
    expect(isOverlayCategory('medical')).toBe(true)
    expect(isOverlayCategory('gathering_point')).toBe(true)
    expect(isOverlayCategory('constructor')).toBe(false)
    expect(isOverlayCategory('__proto__')).toBe(false)
    expect(isOverlayCategory('["amenity"="hospital"]')).toBe(false)
    expect(isOverlayCategory(42)).toBe(false)
  })

  it('gives every category a colour, a label and real OSM filters', () => {
    for (const [key, category] of Object.entries(OVERLAY_CATEGORIES)) {
      expect(category.label, key).toBeTruthy()
      expect(category.colour, key).toMatch(/^#[0-9a-f]{6}$/i)
      expect(category.filters.length, key).toBeGreaterThan(0)
      for (const filter of category.filters) {
        expect(filter, key).toMatch(/^\["[a-z_:]+"="[a-z_]+"\]$/)
      }
    }
  })

  it('offers the model a menu it can actually choose from', () => {
    const menu = categoryMenu()
    expect(menu).toContain('medical:')
    expect(menu.split('\n')).toHaveLength(Object.keys(OVERLAY_CATEGORIES).length)
  })
})
