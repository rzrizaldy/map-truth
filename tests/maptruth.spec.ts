import { expect, test } from '@playwright/test'

test('landing routes client-side into the live agent canvas', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Art direction can wander/ })).toBeVisible()
  await page.getByRole('link', { name: 'Open the demo ↓' }).click()
  await expect(page).toHaveURL(/\/demo$/)
  await expect(page.getByRole('heading', { name: /Move. Lock. Prove what changed/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Lock live OSM' }).first()).toBeVisible()
  await expect(page.getByText('Manual mode', { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('live viewport lock does not wait for Overpass', async ({ page }) => {
  await page.goto('/demo')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25_000 })
  await page.getByRole('button', { name: 'Lock live OSM' }).first().click()
  await expect(page.getByText('LIVE OSM LOCK', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/live OSM features locked/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate all 3 with GPT Image 2' })).toBeVisible()
  await expect(page.locator('[data-source-id^="tile:"]').first()).toHaveAttribute('data-geometry-hash')
})

test('agent mode registers eight visible WebMCP tools and stages cost approval', async ({ page }) => {
  await page.addInitScript(() => {
    const registered: Array<{ name: string; execute: (input: unknown) => unknown }> = []
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool: async (tool: { name: string; execute: (input: unknown) => unknown }) => { registered.push(tool) },
      },
    })
    ;(window as unknown as { __mapTruthTools: typeof registered }).__mapTruthTools = registered
  })
  await page.goto('/demo')
  await expect(page.getByText('Agent mode · 8 tools', { exact: true })).toBeVisible({ timeout: 15_000 })
  const names = await page.evaluate(() => (window as unknown as { __mapTruthTools: Array<{ name: string }> }).__mapTruthTools.map((tool) => tool.name))
  expect(names).toEqual([
    'inspect_map_context', 'navigate_map', 'lock_live_osm', 'verify_osm_lock',
    'generate_comparison', 'inspect_comparison', 'verify_geography', 'export_artwork',
  ])
  await page.evaluate(async () => {
    const tool = (window as unknown as { __mapTruthTools: Array<{ name: string; execute: (input: unknown) => unknown }> }).__mapTruthTools.find((item) => item.name === 'generate_comparison')
    await tool?.execute({ routes: ['promptOnly'], prompt: 'A civic print in red and black' })
  })
  await expect(page.getByText('WEBMCP COST GATE')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Approve generation' })).toBeVisible()
})

test('about page uses a live Jakarta camera and keeps attributed export', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByText('Jakarta is a starting camera, not a bundled dataset.')).toBeVisible()
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25_000 })
  await expect(page.getByText('LIVE OSM LOCK', { exact: true }).first()).toBeVisible({ timeout: 15_000 })

  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export SVG' }).click()
  const svg = await (await svgDownload).createReadStream()
  let xml = ''
  for await (const chunk of svg) xml += chunk.toString()
  expect(xml).toContain('MAP DATA © OPENSTREETMAP CONTRIBUTORS')
  expect(xml).not.toContain('<script')
})

test('comparison story remains legible on mobile', async ({ page }) => {
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: /Watch evidence change the image/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prompt only' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Map screenshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MapTruth + WebMCP' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate routes 01 + 02 now' })).toBeVisible()
})
