import { chromium } from '@playwright/test'
const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1440, height: 1150 }, deviceScaleFactor: 2 })
await p.goto('https://map-truth.vercel.app/')
await p.waitForSelector('[data-map-loaded="true"]', { timeout: 40000 })

const examples = await p.evaluate(() =>
  [...document.querySelectorAll('.taste-example img')].map((i) => i.naturalWidth))
console.log('example widths:', JSON.stringify(examples))

// README hero: the three levels side by side.
await p.locator('#step-3').screenshot({ path: '/tmp/hero.png' })

// Agent walkthrough against the real geocoder.
await p.getByRole('textbox').fill('A 1970s Swiss travel poster of Kyoto in autumn')
await p.getByRole('button', { name: 'Run the agent on Kyoto' }).click()
await p.waitForFunction(() => document.querySelectorAll('.agent-step--done').length >= 5, null, { timeout: 90000 })
console.log('steps:', JSON.stringify(await p.evaluate(() =>
  [...document.querySelectorAll('.agent-step')].map((s) => s.className.replace('agent-step agent-step--', '').split(' ')[0]))))
console.log('gate:', await p.locator('.generation-approval strong').textContent())
await b.close()
