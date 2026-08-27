import { expect, test } from '@playwright/test'

test('the prompt offers to move the map to a place it names', async ({ page }) => {
  const jakarta = {
    name: 'Jakarta', label: 'Jakarta, Indonesia',
    center: [106.8272, -6.1751], bbox: [106.68, -6.37, 106.97, -6.08],
    zoom: 12, kind: 'city',
  }
  await page.route('**/api/geocode', async (route) => {
    const body = route.request().postDataJSON() as { center?: unknown }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body.center ? { place: jakarta } : { query: 'Jakarta', places: [jakarta] }),
    })
  })
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25_000 })

  await page.getByRole('textbox').fill('A vintage travel poster of Jakarta at sunset')
  const chip = page.getByRole('button', { name: 'Go to Jakarta' })
  await expect(chip).toBeVisible()
  await chip.click()

  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 25_000 })
  // The prompt, not a manual pan, decided where the grounding came from.
  await expect(page.locator('.status-rail').getByText('Jakarta')).toBeVisible({ timeout: 15_000 })
})

test('warns when the prompt names somewhere the map is not', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25_000 })
  await page.locator('#step-2').getByRole('button', { name: 'Use this view' }).click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

  await page.getByRole('textbox').fill('A poster of Jakarta at sunset')
  await expect(page.getByText(/your prompt mentions Jakarta, but the map is on/i)).toBeVisible({ timeout: 15_000 })
})

test('the whole journey lives on one page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /AI makes up cities/ })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Pick the place' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Spot the difference' })).toBeVisible()
  await expect(page.locator('#step-2').getByRole('button', { name: 'Use this view' })).toBeVisible()
  await expect(page.getByText('Manual mode', { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('legacy /demo and /about links land on the same journey', async ({ page }) => {
  await page.goto('/about')
  await expect(page).toHaveURL(/\/(#.*)?$/)
  await expect(page.getByRole('heading', { name: 'Pick the place' })).toBeVisible()
})

test('live viewport lock does not wait for Overpass', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 25_000 })
  await page.locator('#step-2').getByRole('button', { name: 'Use this view' }).click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/real shapes/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Make 3 images' })).toBeVisible()
  await expect(page.locator('[data-source-id^="tile:"]').first()).toHaveAttribute('data-geometry-hash')
})

test('agent mode registers nine visible WebMCP tools and stages cost approval', async ({ page }) => {
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
  await expect(page.getByText('Agent mode · 9 tools', { exact: true })).toBeVisible({ timeout: 15_000 })
  const names = await page.evaluate(() => (window as unknown as { __mapTruthTools: Array<{ name: string }> }).__mapTruthTools.map((tool) => tool.name))
  expect(names).toEqual([
    'inspect_map_context', 'navigate_map', 'focus_place', 'lock_live_osm', 'verify_osm_lock',
    'generate_comparison', 'inspect_comparison', 'verify_geography', 'export_artwork',
  ])
  await page.evaluate(async () => {
    const tool = (window as unknown as { __mapTruthTools: Array<{ name: string; execute: (input: unknown) => unknown }> }).__mapTruthTools.find((item) => item.name === 'generate_comparison')
    await tool?.execute({ routes: ['promptOnly'], prompt: 'A civic print in red and black' })
  })
  await expect(page.getByText('ONE LAST CHECK')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Make them' })).toBeVisible()
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
  // Receipts live behind "Under the hood" so the main flow stays uncluttered.
  await page.getByRole('group').getByText('Under the hood').click()
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
  await page.locator('#step-2').getByRole('button', { name: 'Use this view' }).click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download SVG' }).click()
  const svg = await (await svgDownload).createReadStream()
  let xml = ''
  for await (const chunk of svg) xml += chunk.toString()
  expect(xml).toContain('MAP DATA © OPENSTREETMAP CONTRIBUTORS')
  expect(xml).not.toContain('<script')
})

test('the three routes stay legible on mobile', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Made up' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'From a picture' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Grounded in the real map' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Make 3 images' })).toBeVisible()
})
