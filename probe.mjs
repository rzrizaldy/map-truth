import { chromium } from '@playwright/test'
const b = await chromium.launch(); const p = await b.newPage({ viewport:{width:1440,height:1000} })
await p.goto('http://127.0.0.1:4174/'); await p.waitForSelector('[data-map-loaded="true"]',{timeout:45000})
await p.locator('#step-2').getByRole('button',{name:'Use this view'}).click()
await p.waitForTimeout(3000)
console.log(JSON.stringify(await p.evaluate(async () => {
  const t0 = performance.now()
  const btn = [...document.querySelectorAll('.agent-demo button')]
  return { features: document.querySelector('.map-meta strong')?.textContent, setup: Math.round(performance.now()-t0), btn: btn.length }
})))
// time verify_geography specifically
const t = Date.now()
await p.getByRole('button', { name: /Run the agent on/ }).click()
await p.waitForFunction(() => document.querySelectorAll('.agent-step--done').length >= 4, null, { timeout: 120000 })
console.log('through verify_geography in', Date.now()-t, 'ms')
await b.close()
