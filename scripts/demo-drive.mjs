#!/usr/bin/env node
/**
 * Drive the demo on a fixed clock, so a recording only needs a voice.
 *
 * Opens the app in a real Chrome with WebMCP switched on, then performs the
 * run beat by beat, printing the line to say as each beat starts. Start a
 * screen recorder, run this, talk over it. Every timing below is measured, not
 * hoped for: the examples replay a checked-in OpenStreetMap snapshot, so the
 * only thing still on the network is the image generation.
 *
 *   npm run demo:drive                       # production, New York
 *   npm run demo:drive -- pittsburgh         # the confluence run
 *   npm run demo:drive -- newyork http://localhost:4174
 */
import { chromium } from '@playwright/test'

const SCENARIOS = {
  newyork: {
    example: 'New York landmarks & subway',
    beats: [
      'The model suggested eight landmarks. Six exist here. Watch the two that do not.',
      'Six of eight verified — it named the Statue of Liberty, and OpenStreetMap says that is not in this view, so it was not placed.',
    ],
  },
  pittsburgh: {
    example: 'Pittsburgh POGOH bike share',
    beats: [
      'Pittsburgh is three rivers meeting at a point. Remember that shape.',
      'Every dock here is a real POGOH station, named the way the sign on the street names it.',
    ],
  },
}

const [key = 'newyork', url = 'https://map-truth.vercel.app/'] = process.argv.slice(2)
const scenario = SCENARIOS[key]
if (!scenario) {
  console.error(`Unknown scenario "${key}". Try: ${Object.keys(SCENARIOS).join(', ')}`)
  process.exit(2)
}

const wait = (seconds) => new Promise((resolve) => setTimeout(resolve, seconds * 1_000))
const started = Date.now()
const cue = (line) => console.log(`  ${String(Math.round((Date.now() - started) / 1000)).padStart(3)}s  ${line}`)

const context = await chromium.launchPersistentContext('', {
  channel: 'chrome',
  headless: false,
  args: ['--enable-features=WebMCP', '--start-maximized'],
  viewport: null,
})
const page = context.pages()[0] ?? (await context.newPage())

console.log('\n  Recording cues — start your recorder, then press Enter.\n')
process.stdin.setRawMode?.(true)
await new Promise((resolve) => process.stdin.once('data', resolve))
process.stdin.setRawMode?.(false)
process.stdin.pause()

await page.goto(url)
await page.waitForSelector('[data-map-loaded="true"]', { timeout: 60_000 })
cue('This is a live OpenStreetMap view. Nothing on it is generated.')
await wait(6)

cue(scenario.beats[0])
await page.locator('.example', { hasText: scenario.example }).click()
await page.locator('.button--go:not([disabled])').waitFor({ timeout: 60_000 })
await wait(3)

cue(scenario.beats[1])
await wait(9)

cue('Now make both maps — same brief, one grounded and one not.')
await page.locator('.button--go').click()
// Two image generations; the only genuinely live wait in the run.
await page.locator('.taste-visual img').nth(1).waitFor({ timeout: 180_000 })
cue('Left: no map. Right: the map you just watched get built.')
await wait(12)

cue('Done. Stop the recording when you are ready — the browser stays open.')
await new Promise(() => {})
