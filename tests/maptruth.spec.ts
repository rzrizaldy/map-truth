import { expect, test, type Page } from '@playwright/test'

const JAKARTA = {
  name: 'Dewan Perwakilan Rakyat', label: 'Dewan Perwakilan Rakyat, Jakarta, Indonesia',
  center: [106.80029, -6.2102083], bbox: [106.79, -6.22, 106.81, -6.2], zoom: 14.6, kind: 'office',
}

/**
 * Most tests need a destination without depending on Nominatim being up, and
 * without paying for a live lookup on every keystroke.
 */
const stubPlace = async (page: Page, place = JAKARTA) => {
  await page.route('**/api/geocode', async (route) => {
    const body = route.request().postDataJSON() as { center?: unknown }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body.center ? { place } : { query: 'x', places: [place] }),
    })
  })
}

const stubMarking = async (page: Page, categories: Array<{ key: string; label: string; colour: string }>, markers: unknown[]) => {
  await page.route('**/api/plan-overlays', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ categories }),
  }))
  await page.route('**/api/osm-overlays', (route) => route.fulfill({
    status: 200, contentType: 'application/json', body: JSON.stringify({ markers }),
  }))
}

/** Choose a place the way a visitor does: search, then pick a real result. */
const pickPlace = async (page: Page, query = 'Jakarta') => {
  await page.getByRole('searchbox', { name: 'Search for a place' }).fill(query)
  // Only real results are buttons; the searching/empty rows are notes.
  await page.locator('button.place-result').first().click()
  await expect(page.locator('.place-chosen')).toContainText(JAKARTA.name, { timeout: 30_000 })
}

const settled = async (page: Page) => {
  await pickPlace(page)
  await expect(page.locator('.readback')).toContainText('Grounded', { timeout: 30_000 })
}

const generate = async (page: Page) => {
  await settled(page)
  const go = page.getByRole('button', { name: /Make both maps/ })
  await expect(go).toBeEnabled({ timeout: 30_000 })
  await go.click()
  await expect(page.locator('.stepper .on')).toContainText('Compare')
}

test('nothing can be generated until a place is actually chosen', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })

  // The guard that matters: no place, no grounding, no generation.
  await expect(page.getByRole('button', { name: /Make both maps/ })).toBeDisabled()
  await expect(page.locator('.readback')).toContainText('Pick a place')
})

test('changing the place refuses to reuse the old lock', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await settled(page)
  await expect(page.getByRole('button', { name: /Make both maps/ })).toBeEnabled({ timeout: 30_000 })

  // Regression: a stale lock once grounded a Bandung brief on Jakarta.
  await page.getByRole('button', { name: 'Change' }).click()
  await expect(page.getByRole('button', { name: /Make both maps/ })).toBeDisabled()
  await expect(page.locator('.readback')).toContainText('Pick a place')
})

test('the brief is read back before anything commits to it', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page,
    [{ key: 'medical', label: 'Medical', colour: '#ea4335' }],
    [{ category: 'medical', label: 'Medical', colour: '#ea4335', name: 'Posyandu RW 02', center: [106.7946, -6.2103], osmId: 'osm:n1' }])

  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await settled(page)

  // What was understood is shown as text the user can read and correct.
  await expect(page.locator('.readback')).toContainText(JAKARTA.name)
  await expect(page.locator('.readback')).toContainText('Medical', { timeout: 25_000 })
})

test('choosing a place locks that place and says so', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await pickPlace(page)

  await expect(page.locator('.map-meta')).toContainText('Using this view', { timeout: 30_000 })
  await expect(page.locator('.readback')).toContainText('OpenStreetMap shapes', { timeout: 25_000 })
})

test('a search that matches nothing says so', async ({ page }) => {
  await page.route('**/api/geocode', (route) => route.fulfill({
    status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'place_not_found' }),
  }))
  await stubMarking(page, [], [])
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await page.getByRole('searchbox', { name: 'Search for a place' }).fill('zzzzzzz')
  await expect(page.locator('.place-note')).toContainText('Nothing on the map matches', { timeout: 20_000 })
})

test('the examples are one click and set a consistent state', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await expect(page.locator('.example')).toHaveCount(3)

  // An example sets both halves — the place and the brief — so it lands ready.
  await page.locator('.example', { hasText: 'Pittsburgh bike trail' }).click()
  await expect(page.getByRole('textbox')).toHaveValue(/Bike trail map/)
  await expect(page.locator('.place-chosen')).toBeVisible({ timeout: 30_000 })
})

test('the brief decides what gets marked, OpenStreetMap decides where', async ({ page }) => {
  await stubPlace(page)
  await page.route('**/api/plan-overlays', (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      categories: [
        { key: 'gathering_point', label: 'Gathering point', colour: '#1a73e8' },
        { key: 'medical', label: 'Medical', colour: '#ea4335' },
      ],
    }),
  }))
  await page.route('**/api/osm-overlays', async (route) => {
    const body = route.request().postDataJSON() as { categories?: string[] }
    // Reasoning is a closed vocabulary; no coordinates come back from the model.
    expect(body.categories).toEqual(['gathering_point', 'medical'])
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        markers: [
          { category: 'gathering_point', label: 'Gathering point', colour: '#1a73e8', name: 'Lapangan Panahan', center: [106.8019, -6.2148], osmId: 'osm:w1' },
          { category: 'medical', label: 'Medical', colour: '#ea4335', name: 'Posyandu RW 02', center: [106.7946, -6.2103], osmId: 'osm:n2' },
        ],
      }),
    })
  })

  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await settled(page)

  await expect(page.locator('.readback')).toContainText('Gathering point', { timeout: 25_000 })
  // Markers must land on the map itself, or they never reach the image model.
  await expect(page.locator('.map-canvas')).toHaveAttribute('data-overlay-markers', '2', { timeout: 25_000 })
})

test('choosing a result does not look it up a second time', async ({ page }) => {
  const asked: string[] = []
  await page.route('**/api/geocode', async (route) => {
    const body = route.request().postDataJSON() as { query?: string; center?: unknown }
    if (body.center) {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ place: JAKARTA }) })
    }
    const query = String(body.query ?? '')
    asked.push(query)
    // Real Nominatim cannot resolve its own long display label. Depending on
    // that round-trip left the map unlocked and the panel waiting forever.
    if (query.includes(',')) {
      return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: 'place_not_found' }) })
    }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ query, places: [JAKARTA] }) })
  })
  await stubMarking(page, [], [])

  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await pickPlace(page)

  await expect(page.locator('.readback')).toContainText('Grounded', { timeout: 30_000 })
  await expect(page.getByRole('button', { name: /Make both maps/ })).toBeEnabled({ timeout: 30_000 })
  expect(asked.some((query) => query.includes(','))).toBe(false)
})

test('waterways are never drawn as lines', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await settled(page)

  // A blue line over a river reads as a road that is not there.
  const drawn = await page.evaluate(() => {
    const map = (window as unknown as { __mapTruthMap?: { queryRenderedFeatures: (options: unknown) => Array<{ properties: Record<string, unknown> }> } }).__mapTruthMap
    if (!map) return null
    return map.queryRenderedFeatures({ layers: ['maptruth-lock-lines'] })
      .map((feature) => String(feature.properties.type))
  })
  expect(drawn).not.toBeNull()
  expect(drawn).not.toContain('water')
  expect(drawn?.length).toBeGreaterThan(0)
})

test('one screen at a time — the page never scrolls', async ({ page, isMobile }) => {
  test.skip(Boolean(isMobile), 'mobile stacks the panel above the map and scrolls by design')
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  const overflows = await page.evaluate(() => document.documentElement.scrollHeight > window.innerHeight + 2)
  expect(overflows).toBe(false)
  await expect(page.locator('.stepper .on')).toContainText('Ask')
})

test('generating advances to the comparison and back', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  // Never spend real money in a test.
  await page.route('**/api/generate-route', (route) => route.fulfill({
    status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'image_generation_failed', detail: 'stubbed' }),
  }))

  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await generate(page)
  await expect(page.locator('.taste-card')).toHaveCount(2)
  await page.getByRole('button', { name: /Change the brief/ }).click()
  await expect(page.locator('.stepper .on')).toContainText('Ask')
})

test('the grounded result states a source anyone can check', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.route('**/api/generate-route', (route) => route.fulfill({
    status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'image_generation_failed' }),
  }))

  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await generate(page)

  const cards = page.locator('.taste-card')
  await expect(cards.first().locator('.provenance--none')).toContainText('invented by the model')
  const grounded = cards.nth(1).locator('.provenance')
  await expect(grounded).toContainText('OpenStreetMap shapes verified')
  await expect(grounded.getByRole('link', { name: /Check on OpenStreetMap/ }))
    .toHaveAttribute('href', /openstreetmap\.org\/#map=16\/-?\d+\.\d+\/-?\d+\.\d+/)
})

test('a result opens full screen and closes again', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.route('**/api/generate-route', (route) => route.fulfill({
    status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'x' }),
  }))
  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await generate(page)

  await page.locator('.taste-visual--zoom').first().click()
  await expect(page.locator('.lightbox')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.lightbox')).toHaveCount(0)
})

test('legacy /demo and /about links land on the same journey', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/about')
  await expect(page).toHaveURL(/\/(#.*)?$/)
  await expect(page.getByRole('heading', { name: /Make a map that is actually there/ })).toBeVisible()
})

test('the header states whether an agent can drive the page', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/')
  // No WebMCP in plain Playwright Chromium, and the page must say so.
  await expect(page.locator('.agent-mode')).toContainText('Manual mode', { timeout: 20_000 })
})

test('agent mode registers ten visible WebMCP tools', async ({ page }) => {
  await page.addInitScript(() => {
    const registered: Array<{ name: string; execute: (input: unknown) => unknown }> = []
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: { registerTool: async (tool: never) => { registered.push(tool) } },
    })
    ;(window as unknown as { __mapTruthTools: typeof registered }).__mapTruthTools = registered
  })
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.goto('/')

  await expect(page.locator('.agent-mode')).toContainText('Agent mode · 10 tools', { timeout: 20_000 })
  const names = await page.evaluate(() => (window as unknown as { __mapTruthTools: Array<{ name: string }> }).__mapTruthTools.map((tool) => tool.name))
  expect(names).toEqual([
    'inspect_map_context', 'navigate_map', 'focus_place', 'lock_live_osm', 'verify_osm_lock',
    'mark_from_osm', 'generate_comparison', 'inspect_comparison', 'verify_geography', 'export_artwork',
  ])
})

test('the agent drawer runs the real tools and stops at the cost gate', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page,
    [{ key: 'medical', label: 'Medical', colour: '#ea4335' }],
    [{ category: 'medical', label: 'Medical', colour: '#ea4335', name: 'Posyandu', center: [106.7946, -6.2103], osmId: 'osm:n1' }])

  await page.goto('/')
  await expect(page.locator('[data-map-loaded="true"]')).toBeVisible({ timeout: 45_000 })
  await settled(page)
  await page.locator('.agent-toggle').click()
  await expect(page.locator('.drawer')).toBeVisible()
  // The drawer showcases what an agent can call.
  await expect(page.locator('.tool-list li')).toHaveCount(10)

  await page.getByRole('button', { name: /^Run the agent on / }).click()
  await expect(page.locator('.agent-step--done')).toHaveCount(6, { timeout: 120_000 })
  await expect(page.locator('.agent-step--blocked')).toHaveCount(0)
  await expect(page.locator('.agent-step').filter({ hasText: 'verify_geography' })).toContainText('match their source')
  await expect(page.locator('.agent-step').filter({ hasText: 'mark_from_osm' })).toContainText('marked')
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
  await stubPlace(page)
  await stubMarking(page, [], [])
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

  const lock = await call('lock_live_osm', {})
  expect(lock).toMatchObject({ status: 'ok', lockType: 'live_osm' })
  expect(Number(lock.featureCount)).toBeGreaterThan(0)

  expect(await call('verify_geography', {})).toMatchObject({
    status: 'verified', allGeographicFeaturesSourceBacked: true,
  })
})

test('both stages stay usable on mobile', async ({ page }) => {
  await stubPlace(page)
  await stubMarking(page, [], [])
  await page.route('**/api/generate-route', (route) => route.fulfill({
    status: 502, contentType: 'application/json', body: JSON.stringify({ error: 'x' }),
  }))
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Make a map that is actually there/ })).toBeVisible()
  await expect(page.getByRole('searchbox', { name: 'Search for a place' })).toBeVisible()
  await expect(page.locator('.ask-input')).toBeVisible()
  await expect(page.locator('.example')).toHaveCount(3)
})
