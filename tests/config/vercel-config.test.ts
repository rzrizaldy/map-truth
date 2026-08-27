import { afterEach, describe, expect, it, vi } from 'vitest'

const loadConfig = async () => {
  vi.resetModules()
  return (await import('../../vercel.ts')).config
}

const headerValues = (config: Awaited<ReturnType<typeof loadConfig>>, key: string) =>
  (config.headers ?? []).flatMap((rule) =>
    ('headers' in rule ? rule.headers : []).filter((header) => header.key === key).map((header) => header.value))

afterEach(() => {
  delete process.env.WEBMCP_ORIGIN_TRIAL_TOKEN
})

describe('deployment config', () => {
  it('emits the WebMCP Origin-Trial header only when a token is configured', async () => {
    expect(headerValues(await loadConfig(), 'Origin-Trial')).toEqual([])

    process.env.WEBMCP_ORIGIN_TRIAL_TOKEN = 'trial-token'
    expect(headerValues(await loadConfig(), 'Origin-Trial')).toEqual(['trial-token'])
  })

  it('always allows WebMCP tools and the OpenFreeMap tile origins', async () => {
    const config = await loadConfig()
    expect(headerValues(config, 'Permissions-Policy')).toEqual(['tools=(self)'])
    const csp = headerValues(config, 'Content-Security-Policy')[0]
    expect(csp).toContain('https://tiles.openfreemap.org')
    expect(csp).toContain("worker-src 'self' blob:")
    expect(csp).toContain("frame-ancestors 'none'")
  })

  it('keeps API routes out of the SPA rewrite', async () => {
    const config = await loadConfig()
    expect(config.rewrites?.[0]).toMatchObject({ source: '/((?!api/).*)', destination: '/index.html' })
  })
})
