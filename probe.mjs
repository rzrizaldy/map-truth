import { chromium } from '@playwright/test'
const b = await chromium.launch()
for (let run = 1; run <= 3; run++) {
  const p = await b.newPage({ viewport:{width:1440,height:900} })
  await p.goto('http://127.0.0.1:4174/')
  await p.waitForSelector('[data-map-loaded="true"]',{timeout:60000})
  await p.getByRole('searchbox',{name:'Search for a place'}).fill('Bandung')
  await p.waitForSelector('button.place-result',{timeout:40000})
  await p.locator('button.place-result').first().click()
  const t0 = Date.now()
  await p.getByRole('textbox').fill('Bandung Best Coffeshop')
  await p.waitForFunction(() => { const b = document.querySelector('.button--go'); return b && !b.disabled }, null, { timeout: 180000 })
  console.log(`run ${run} (${((Date.now()-t0)/1000).toFixed(1)}s): ${await p.evaluate(() => document.querySelector('.readback')?.innerText.replace(/\n/g,' | '))}`)
  await p.close()
}
await b.close()
