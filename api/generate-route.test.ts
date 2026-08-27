import { generateImage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './generate-route'

vi.mock('ai', () => ({
  generateImage: vi.fn(),
  NoImageGeneratedError: { isInstance: () => false },
}))

beforeEach(() => {
  vi.mocked(generateImage).mockReset()
  vi.mocked(generateImage).mockResolvedValue({ image: { mediaType: 'image/png', base64: 'aW1hZ2U=' } } as never)
})

const request = (body: unknown) => new Request('http://localhost/api/generate-route', { method: 'POST', body: JSON.stringify(body) })

describe('independent gpt-image-2 route endpoint', () => {
  it('runs prompt-only without requiring a screenshot', async () => {
    const response = await handler(request({ route: 'promptOnly', prompt: 'Editorial map poster' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ route: 'promptOnly', model: 'openai/gpt-image-2' })
    expect(generateImage).toHaveBeenCalledTimes(1)
  })

  it('validates route-specific evidence', async () => {
    expect((await handler(request({ route: 'screenshotGrounded', prompt: 'Poster' }))).status).toBe(400)
    expect((await handler(request({ route: 'mapTruthGrounded', prompt: 'Poster', sourceImageDataUrl: 'data:image/png;base64,aA==' }))).status).toBe(400)
    expect((await handler(request({ route: 'invented', prompt: 'Poster' }))).status).toBe(400)
    expect(generateImage).not.toHaveBeenCalled()
  })

  it('accepts a bounded JPEG basemap capture', async () => {
    const response = await handler(request({
      route: 'screenshotGrounded', prompt: 'Poster', sourceImageDataUrl: 'data:image/jpeg;base64,aA==',
    }))
    expect(response.status).toBe(200)
    expect(generateImage).toHaveBeenCalledTimes(1)
  })

  it('uses the screenshot only as art context for MapTruth-grounded output', async () => {
    const response = await handler(request({
      route: 'mapTruthGrounded', prompt: 'Civic print', sourceImageDataUrl: 'data:image/png;base64,aA==', mapSummary: '{"lock":"live"}',
    }))
    expect(response.status).toBe(200)
    const options = vi.mocked(generateImage).mock.calls[0][0]
    const prompt = options.prompt as { text: string; images: string[] }
    expect(prompt.text).toContain('Do not draw roads, rivers, routes, boundaries, maps, labels')
    expect(prompt.images).toHaveLength(1)
    expect(options.size).toBe('1024x1536')
  })
})
