import { chromium } from '@playwright/test'
const ctx = await chromium.launchPersistentContext('', {
  channel: 'chrome', headless: true,
  args: ['--enable-features=WebMCP'],
  viewport: { width: 1440, height: 1100 },
})
const page = await ctx.newPage()
await page.goto('https://map-truth.vercel.app/')
await page.waitForSelector('[data-map-loaded="true"]', { timeout: 45000 })

console.log('agent badge :', await page.locator('.agent-mode').textContent())
console.log('mode message:', (await page.locator('.agent-demo-note').textContent()).slice(0, 80))

const tools = await page.evaluate(async () => {
  const list = await document.modelContext.getTools()
  return list.map((t) => ({ name: t.name, hasSchema: !!t.inputSchema, ro: t.annotations?.readOnlyHint }))
})
console.log('registered  :', tools.length)
console.log(tools.map((t) => `  ${t.name.padEnd(22)} schema=${t.hasSchema} readOnly=${t.ro}`).join('\n'))
await ctx.close()
