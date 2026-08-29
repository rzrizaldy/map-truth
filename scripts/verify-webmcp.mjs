#!/usr/bin/env node
/**
 * Prove that real WebMCP works — not a stand-in.
 *
 * Launches the installed Google Chrome with the WebMCP feature enabled (the
 * command-line equivalent of chrome://flags/#enable-webmcp-testing), loads the
 * app, and asks the browser's own `document.modelContext.getTools()` what the
 * page registered. Nothing here is mocked: if this passes, an agent in a
 * WebMCP-capable browser sees exactly these nine tools.
 *
 *   npm run verify:webmcp                    # against production
 *   npm run verify:webmcp -- http://…:4174   # against a local build
 */
import { chromium } from '@playwright/test'

const url = process.argv[2] ?? 'https://map-truth.vercel.app/'
const EXPECTED = [
  'export_artwork', 'focus_place', 'generate_comparison', 'inspect_comparison',
  'inspect_map_context', 'lock_live_osm', 'mark_from_osm', 'navigate_map',
  'verify_geography', 'verify_osm_lock',
].sort()

const fail = (message) => { console.error(`FAIL  ${message}`); process.exitCode = 1 }
const pass = (message) => console.log(`ok    ${message}`)

let context
try {
  context = await chromium.launchPersistentContext('', {
    channel: 'chrome',
    headless: true,
    args: ['--enable-features=WebMCP'],
    viewport: { width: 1440, height: 1000 },
  })
} catch (error) {
  console.error('Could not launch Google Chrome. Install Chrome, or run the app in')
  console.error('Chrome manually with chrome://flags/#enable-webmcp-testing enabled.')
  console.error(String(error).split('\n')[0])
  process.exit(2)
}

const page = await context.newPage()
console.log(`\nWebMCP verification — ${url}\n`)

try {
  await page.goto(url)
  await page.waitForSelector('[data-map-loaded="true"]', { timeout: 45_000 })

  const exposed = await page.evaluate(() => typeof document.modelContext)
  exposed === 'object'
    ? pass('document.modelContext is exposed by the browser')
    : fail(`document.modelContext is ${exposed} — the WebMCP feature is not active`)

  const tools = await page.evaluate(async () => {
    const registered = await document.modelContext.getTools()
    return registered.map((tool) => ({
      name: tool.name,
      description: tool.description,
      hasSchema: Boolean(tool.inputSchema),
      readOnly: tool.annotations?.readOnlyHint ?? false,
    }))
  })

  const names = tools.map((tool) => tool.name).sort()
  JSON.stringify(names) === JSON.stringify(EXPECTED)
    ? pass(`all ${EXPECTED.length} tools registered and discoverable`)
    : fail(`expected ${EXPECTED.join(', ')} — got ${names.join(', ') || '(none)'}`)

  const noSchema = tools.filter((tool) => !tool.hasSchema).map((tool) => tool.name)
  noSchema.length ? fail(`missing input schema: ${noSchema.join(', ')}`) : pass('every tool publishes an input schema')

  const thin = tools.filter((tool) => (tool.description ?? '').length < 40).map((tool) => tool.name)
  thin.length ? fail(`description too thin to be useful: ${thin.join(', ')}`) : pass('every tool describes itself')

  const readOnly = tools.filter((tool) => tool.readOnly).map((tool) => tool.name).sort()
  JSON.stringify(readOnly) === JSON.stringify(['inspect_comparison', 'inspect_map_context'])
    ? pass('only the two inspect tools claim readOnlyHint')
    : fail(`readOnlyHint set on: ${readOnly.join(', ') || '(none)'}`)

  // The badge is the claim a visitor actually sees, so check the rendered one.
  const badge = (await page.locator('.agent-mode').first().textContent({ timeout: 15_000 }).catch(() => null))?.trim()
  badge?.includes('Agent mode')
    ? pass(`the page reports "${badge}"`)
    : fail(`the page reports "${badge ?? 'no badge at all'}" with WebMCP present`)

  console.log(`\n${tools.map((t) => `  ${t.name}`).join('\n')}\n`)
} finally {
  await context.close()
}

console.log(process.exitCode ? 'WebMCP verification FAILED\n' : 'WebMCP verification passed\n')
