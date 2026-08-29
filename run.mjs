import { chromium } from '@playwright/test'
const EXAMPLES = ['Peta demo DPR Jakarta', 'New York iconic landmarks', 'Pittsburgh bike trail']
const b = await chromium.launch()
for (const [i, label] of EXAMPLES.entries()) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  await p.goto('https://map-truth.vercel.app/')
  await p.waitForSelector('[data-map-loaded="true"]', { timeout: 45000 })
  await p.locator('.example', { hasText: label }).click()
  await p.waitForFunction(() => document.querySelector('.map-meta')?.textContent?.includes('Using this view'), null, { timeout: 45000 })
  await p.waitForTimeout(9000)
  const state = await p.evaluate(() => ({
    place: document.querySelector('.readback em')?.textContent,
    chips: [...document.querySelectorAll('.readback-chip')].map(c => c.textContent),
    markers: document.querySelector('.map-canvas')?.getAttribute('data-overlay-markers'),
  }))
  console.log(`${label.padEnd(26)} -> ${state.place} | ${state.chips.join(', ')} | ${state.markers} markers`)
  await p.screenshot({ path: `/tmp/ex-${i + 1}.png` })
  await p.close()
}
await b.close()
