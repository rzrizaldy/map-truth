import { expect, test } from '@playwright/test'

test('manual geometry-lock workflow and SVG export', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Art direction can wander/ })).toBeVisible()
  await expect(page.getByText('9,498 features', { exact: true })).toBeVisible()
  await expect(page.getByText(/source fragments painted by MapLibre/)).toBeVisible({ timeout: 20_000 })
  await expect(page.locator('[data-source-id^="osm:"]').first()).toHaveAttribute('data-geometry-hash')
  await expect(page.getByText('WebMCP unavailable', { exact: true })).toBeVisible()

  await page.getByRole('button', { name: 'Verify' }).click()
  await expect(page.getByText(/Every geographic layer is source-backed/)).toBeVisible()
  await expect(page.getByLabel('Reveal source geometry beneath poster')).toHaveValue('50')

  const svgDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export SVG' }).click()
  const svg = await (await svgDownload).createReadStream()
  let xml = ''
  for await (const chunk of svg) xml += chunk.toString()
  expect(xml).toContain('MAP DATA © OPENSTREETMAP CONTRIBUTORS')
  expect(xml).toContain('data-geometry-hash')
  expect(xml).not.toContain('<script')

  const pngDownload = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Export PNG' }).click()
  const pngStream = await (await pngDownload).createReadStream()
  const chunks: Buffer[] = []
  for await (const chunk of pngStream) chunks.push(Buffer.from(chunk))
  const png = Buffer.concat(chunks)
  expect(png.readUInt32BE(16)).toBe(2400)
  expect(png.readUInt32BE(20)).toBe(3000)
})

test('three-version tasting story remains clear on mobile', async ({ page }) => {
  await page.goto('/#taste-test')
  await expect(page.getByRole('heading', { name: /Three very different relationships/i })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Prompt only' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Map screenshot' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'MapTruth + WebMCP' })).toBeVisible()
  await expect(page.getByText('Geography: geometry-locked')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate 3 versions with GPT Image 2' })).toBeVisible()
})
