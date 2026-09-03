#!/usr/bin/env node
/**
 * Capture a demo scenario from the real pipeline, once, so it can be replayed.
 *
 * Nothing here is written by hand: the place comes from the geocoder, the
 * categories and suggested names from the model, the coordinates from
 * OpenStreetMap. The result is the same answer the live path gives, kept on
 * disk so a recording does not depend on three services all being awake at the
 * moment somebody presses record — the model plan alone has been measured at
 * 14s on a good run and timing out on a bad one.
 *
 *   npm run capture:preload                    # against production
 *   npm run capture:preload -- http://…:3000   # against a local dev server
 */
import { writeFileSync } from 'node:fs'
import { EXAMPLES } from '../src/map/examples.ts'

const base = (process.argv[2] ?? 'https://map-truth.vercel.app').replace(/\/$/, '')
const OUT = new URL('../src/map/preload.data.json', import.meta.url)

const post = async (path, body) => {
  const response = await fetch(`${base}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (payload?.error) throw new Error(`${path}: ${payload.error}`)
  return payload
}

// A retry is honest here in a way it is not at demo time: this runs once, the
// answer is checked in, and a flaky minute should not decide what ships.
const insist = async (label, attempt, tries = 4) => {
  for (let round = 1; round <= tries; round += 1) {
    try {
      return await attempt()
    } catch (error) {
      console.log(`      ${label} attempt ${round}/${tries}: ${error.message}`)
      if (round === tries) throw error
      await new Promise((resolve) => setTimeout(resolve, 2_000 * round))
    }
  }
}

const capture = async (example) => {
  console.log(`\n  ${example.label}`)
  const { places } = await insist('geocode', () => post('/api/geocode', { query: example.place }))
  const place = places?.[0]
  if (!place) throw new Error(`no geocode match for "${example.place}"`)
  console.log(`      place    ${place.label}`)

  const plan = await insist('plan', () => post('/api/plan-overlays', { prompt: example.prompt, place: place.label }))
  const categories = plan.categories ?? []
  const suggested = plan.places ?? []
  console.log(`      plan     ${categories.map((c) => c.key).join(', ') || 'nothing'}${suggested.length ? ` + ${suggested.length} named` : ''}`)

  const markers = categories.length
    ? (await insist('overlays', () => post('/api/osm-overlays', {
        bbox: place.bbox, categories: categories.map((category) => category.key),
      }))).markers ?? []
    : []
  console.log(`      markers  ${markers.length}`)

  // The named lookup answers per query, and an unresolved name is a real
  // result — it is dropped, and the count of what was dropped is the point.
  const named = suggested.length
    ? ((await insist('named', () => post('/api/osm-named', { names: suggested, bbox: place.bbox }))).results ?? [])
        .filter((result) => result.place)
        .map((result) => ({ name: result.query, label: result.place.name, center: result.place.center }))
    : []
  if (suggested.length) console.log(`      named    ${named.length} of ${suggested.length} verified`)

  return { place, categories, suggested, markers, named }
}

const captured = {}
for (const example of EXAMPLES) {
  try {
    captured[example.label] = await capture(example)
  } catch (error) {
    console.log(`      skipped — ${error.message}`)
  }
}

const count = Object.keys(captured).length
if (!count) {
  console.error('\nNothing captured; leaving the existing snapshot alone.')
  process.exit(1)
}

writeFileSync(OUT, `${JSON.stringify({ capturedAt: new Date().toISOString().slice(0, 10), scenarios: captured }, null, 2)}\n`)
console.log(`\nWrote ${count} scenario${count === 1 ? '' : 's'} to src/map/preload.data.json`)
