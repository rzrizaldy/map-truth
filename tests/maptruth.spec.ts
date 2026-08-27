import { expect, test } from '@playwright/test'

test('the whole journey lives on one page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Art direction can wander/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Lock a place' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Compare the evidence' })).toBeVisible()
  await expect(page.locator('#step-1').getByRole('button', { name: 'Lock this view' })).toBeVisible()
  await expect(page.getByText('Manual mode', { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('legacy /demo and /about links land on the same journey', async ({ page }) => {
  await page.goto('/about')
  await expect(page).toHaveURL(/\/(#.*)?$/)
  await expect(page.getByRole('heading', { name: 'Lock a place' })).toBeVisible()
})

test('live viewport lock does not wait for Overpass', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25_000 })
  await page.locator('#step-1').getByRole('button', { name: 'Lock this view' }).click()
  await expect(page.getByText('OSM locked', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/live OSM features locked/i)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate all 3' })).toBeVisible()
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
  await page.goto('/')
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

test('an agent can navigate and lock through WebMCP alone', async ({ page }) => {
  await page.addInitScript(() => {
    const registered: Array<{ name: string; execute: (input: unknown) => unknown }> = []
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool: async (tool: never) => { registered.push(tool) } },
    })
    ;(window as unknown as { __mapTruthTools: typeof registered }).__mapTruthTools = registered
  })
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25_000 })

  const call = (name: string, input: unknown) => page.evaluate(
    ([toolName, args]) => {
      const tools = (window as unknown as { __mapTruthTools: Array<{ name: string; execute: (input: unknown) => unknown }> }).__mapTruthTools
      return Promise.resolve(tools.find((item) => item.name === toolName)?.execute(args)) as Promise<Record<string, unknown>>
    },
    [name, input] as [string, unknown],
  )

  expect(await call('navigate_map', { center: [2.3364, 48.8606], zoom: 14, label: 'Louvre, Paris' }))
    .toMatchObject({ status: 'ok', artworkGeometryChanged: false })
  await expect(page.getByText('Map moved to Louvre, Paris')).toBeVisible()

  const lock = await call('lock_live_osm', {})
  expect(lock).toMatchObject({ status: 'ok', lockType: 'live_osm' })
  expect(Number(lock.featureCount)).toBeGreaterThan(0)

  const context = await call('inspect_map_context', { detail: 'features' })
  expect(context).toMatchObject({ status: 'ok' })
  expect(String((context.lock as Record<string, unknown>).id)).toMatch(/^live:/)

  expect(await call('verify_geography', {})).toMatchObject({
    status: 'verified',
    allGeographicFeaturesSourceBacked: true,
  })
})

test('exports stay attributed and script-free', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25_000 })
  await page.locator('#step-1').getByRole('button', { name: 'Lock this view' }).click()
  await expect(page.getByText('OSM locked', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export SVG' }).click()
  const svg = await (await svgDownload).createReadStream()
  let xml = ''
  for await (const chunk of svg) xml += chunk.toString()
  expect(xml).toContain('MAP DATA © OPENSTREETMAP CONTRIBUTORS')
  expect(xml).not.toContain('<script')
})

test('the three routes stay legible on mobile', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Prompt only' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Screenshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'WebMCP map truth' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate routes 1 + 2' })).toBeVisible()
})
