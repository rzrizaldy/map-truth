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
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })

  await page.getByRole('textbox').fill('A vintage travel poster of Jakarta at sunset')
  const chip = page.getByRole('button', { name: 'Go to Jakarta' })
  await expect(chip).toBeVisible()
  await chip.click()

  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 45_000 })
  // The prompt, not a manual pan, decided where the grounding came from.
  await expect(page.locator('.status-rail').getByText('Jakarta')).toBeVisible({ timeout: 15_000 })
})

test('warns when the prompt names somewhere the map is not', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await page.locator('#step-2').getByRole('button', { name: 'Use this view' }).click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 10_000 })

  await page.getByRole('textbox').fill('A poster of Jakarta at sunset')
  await expect(page.getByText(/your prompt mentions Jakarta, but the map is somewhere else/i)).toBeVisible({ timeout: 15_000 })
})

test('a first-time visitor sees a finished example, not empty boxes', async ({ page }) => {
  await page.goto('/')
  const examples = page.locator('.taste-example img')
  await expect(examples).toHaveCount(2)
  // Every example must actually load; a broken src would leave the demo blank.
  for (let index = 0; index < 2; index += 1) {
    await expect.poll(() => examples.nth(index).evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0)
  }
})

test('the agent walkthrough runs the real tools and stops at the cost gate', async ({ page }) => {
  const jakarta = {
    name: 'Jakarta', label: 'Jakarta, Indonesia',
    center: [106.8272, -6.1751], bbox: [106.75, -6.25, 106.9, -6.1], zoom: 12.5, kind: 'city',
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
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })

  // The button names whatever the prompt leads with, so match on the action.
  await page.getByRole('button', { name: /^Run the agent on / }).click()

  // Every step must succeed — a blocked step means an agent could not complete
  // the flow either.
  await expect(page.locator('.agent-step--done')).toHaveCount(6, { timeout: 120_000 })
  await expect(page.locator('.agent-step--blocked')).toHaveCount(0)
  await expect(page.locator('.agent-step').filter({ hasText: 'verify_geography' }))
    .toContainText('match their source')

  // It must stop for a human rather than spending money on its own.
  await expect(page.getByText('ONE LAST CHECK')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Make them' })).toBeVisible()
})

test('locking twice in a row keeps working', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  const use = page.locator('#step-2').getByRole('button', { name: /Use this view/ })
  await use.click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  // `map.loaded()` is false while tiles stream, which used to reject the second lock.
  await use.click()
  await expect(page.locator('.map-meta')).toContainText('real shapes')
  await expect(page.getByText('vector map is still loading')).toHaveCount(0)
})

test('the prompt pins a real building at its true coordinates', async ({ page }) => {
  const jakarta = {
    name: 'Jakarta', label: 'Jakarta, Indonesia',
    center: [106.8005, -6.2107], bbox: [106.78, -6.23, 106.82, -6.19], zoom: 14, kind: 'city',
  }
  const dpr = {
    name: 'Dewan Perwakilan Rakyat', label: 'Dewan Perwakilan Rakyat, Jakarta',
    center: [106.80029, -6.2102083], bbox: [106.798, -6.212, 106.802, -6.208], zoom: 16, kind: 'office',
  }
  await page.route('**/api/geocode', async (route) => {
    const body = route.request().postDataJSON() as { center?: unknown; query?: string; within?: unknown }
    if (body.center) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ place: jakarta }) })
    const asksForDpr = (body.query ?? '').includes('DPR')
    const match = asksForDpr ? dpr : jakarta
    // A bounded lookup is what keeps "DPR" from resolving to another city.
    if (asksForDpr) expect(body.within).toBeTruthy()
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query: body.query, places: [match] }) })
  })

  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await page.getByRole('textbox').fill('Peta demo DPR Jakarta')
  await page.getByRole('button', { name: 'Go to Jakarta' }).click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 45_000 })

  await expect(page.locator('.prompt-hint--found')).toContainText('Dewan Perwakilan Rakyat', { timeout: 20_000 })
  // The pin is drawn on the live map, so it is inside the screenshot the
  // image model receives.
  const pinned = await page.evaluate(() => (window as unknown as { __mtPins?: unknown }).__mtPins)
  expect(pinned).toBeUndefined()
  await expect(page.locator('.prompt-hint--found')).toContainText('pinned at real coordinates')
})

test('the grounded result states a source anyone can check', async ({ page }) => {
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })

  // Before any lock, the ungrounded card must already own up to having no source.
  const cards = page.locator('.taste-card')
  await expect(cards.first().locator('.provenance--none')).toContainText('invented by the model')

  await page.locator('#step-2').getByRole('button', { name: 'Use this view' }).click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 15_000 })

  const grounded = cards.nth(1).locator('.provenance')
  await expect(grounded).toContainText('OpenStreetMap shapes verified')
  const check = grounded.getByRole('link', { name: /Check on OpenStreetMap/ })
  // The link must point at the coordinates actually used, not a generic page.
  await expect(check).toHaveAttribute('href', /openstreetmap\.org\/#map=16\/-?\d+\.\d+\/-?\d+\.\d+/)
})

test('the brief decides what gets marked, OpenStreetMap decides where', async ({ page }) => {
  await page.route('**/api/plan-overlays', async (route) => {
    // Reasoning is a closed vocabulary; the model never returns coordinates.
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        categories: [
          { key: 'gathering_point', label: 'Gathering point', colour: '#1a73e8' },
          { key: 'medical', label: 'Medical', colour: '#ea4335' },
        ],
      }),
    })
  })
  await page.route('**/api/osm-overlays', async (route) => {
    const body = route.request().postDataJSON() as { categories?: string[] }
    expect(body.categories).toEqual(['gathering_point', 'medical'])
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        markers: [
          { category: 'gathering_point', label: 'Gathering point', colour: '#1a73e8', name: 'Taman Senayan', center: [106.799, -6.213], osmId: 'osm:w1' },
          { category: 'medical', label: 'Medical', colour: '#ea4335', name: 'RS Pertamina', center: [106.801, -6.208], osmId: 'osm:n2' },
        ],
      }),
    })
  })

  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await page.locator('#step-2').getByRole('button', { name: 'Use this view' }).click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 15_000 })

  await expect(page.locator('.plan-label')).toContainText('Marked on the map from OpenStreetMap', { timeout: 20_000 })
  await expect(page.locator('.plan-chip')).toHaveCount(2)
  await expect(page.locator('.plan-chip').first()).toContainText('Gathering point · 1')

  // The markers must land on the map itself, or they never reach the image model.
  await expect(page.locator('.map-canvas')).toHaveAttribute('data-overlay-markers', '2')
})

test('any result opens full screen and closes again', async ({ page }) => {
  await page.goto('/')
  await page.locator('.taste-visual--zoom').first().click()
  const lightbox = page.locator('.lightbox')
  await expect(lightbox).toBeVisible()
  await expect(lightbox.locator('img, svg').first()).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(lightbox).toHaveCount(0)
})

test('the whole journey lives on one page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /looks exactly like a real one/ })).toBeVisible()
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
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await page.locator('#step-2').getByRole('button', { name: 'Use this view' }).click()
  await expect(page.getByText('Using this view', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
  await expect(page.getByText(/real shapes/i).first()).toBeVisible()
  await expect(page.getByRole('button', { name: 'Make 2 images' })).toBeVisible()
  // Provenance for the captured evidence lives behind "Under the hood".
  await page.getByRole('group').getByText('Under the hood').click()
  await expect(page.locator('.details-body .demo-toolbar-note')).toContainText('fnv1a:')
})

test('agent mode registers ten visible WebMCP tools and stages cost approval', async ({ page }) => {
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
  await expect(page.getByText('Agent mode · 10 tools', { exact: true })).toBeVisible({ timeout: 15_000 })
  const names = await page.evaluate(() => (window as unknown as { __mapTruthTools: Array<{ name: string }> }).__mapTruthTools.map((tool) => tool.name))
  expect(names).toEqual([
    'inspect_map_context', 'navigate_map', 'focus_place', 'lock_live_osm', 'verify_osm_lock',
    'mark_from_osm', 'generate_comparison', 'inspect_comparison', 'verify_geography', 'export_artwork',
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
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })

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

test('both levels stay legible on mobile', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'No map' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Grounded by WebMCP' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Make 2 images' })).toBeVisible()
})
