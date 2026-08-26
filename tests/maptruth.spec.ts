import { expect, test } from '@playwright/test'

test('landing page routes to demo and about', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Art direction can wander/ })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open the demo ↓' })).toBeVisible()
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: /Lock the place/ })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Set boundary' })).toBeVisible()
  await expect(page.getByText('WebMCP unavailable', { exact: true })).toBeVisible({ timeout: 15_000 })
})

test('about page retains jakarta verification studio', async ({ page }) => {
  await page.goto('/about')
  await expect(page.getByRole('heading', { name: /Art direction can wander/ })).toBeVisible()
  await expect(page.getByText('9,498 features', { exact: true })).toBeVisible()
  await expect(page.getByText(/source fragments painted by MapLibre/)).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-source-id^="osm:"]').first()).toHaveAttribute('data-geometry-hash')

  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText(/Every geographic layer is source-backed/)).toBeVisible()

  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export SVG' }).click()
  const svg = await (await svgDownload).createReadStream()
  let xml = ''
  for await (const chunk of svg) xml += chunk.toString()
  expect(xml).toContain('MAP DATA © OPENSTREETMAP CONTRIBUTORS')
  expect(xml).not.toContain('<script')
})

test('demo comparison story remains clear on mobile', async ({ page }) => {
  await page.goto('/demo')
  await expect(page.getByRole('heading', { name: /Three relationships to geographic truth/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prompt only' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Map screenshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MapTruth + WebMCP' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate 3 versions with GPT Image 2' })).toBeVisible()
})
