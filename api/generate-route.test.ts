import { generateImage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET, POST as handler } from './generate-route'

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
  it('exposes a web-standard POST handler, not a Node default export', async () => {
    const response = await handler(request({ route: 'promptOnly', prompt: 'Editorial map poster' }))
    expect(response).toBeInstanceOf(Response)
    expect(GET().status).toBe(405)
  })

  it('runs prompt-only without requiring a screenshot', async () => {
    const response = await handler(request({ route: 'promptOnly', prompt: 'Editorial map poster' }))
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ route: 'promptOnly', model: 'openai/gpt-image-2' })
    expect(generateImage).toHaveBeenCalledTimes(1)
  })

  it('validates route-specific evidence', async () => {
    expect((await handler(request({ route: 'screenshotGrounded', prompt: 'Poster' }))).status).toBe(400)
    expect((await handler(request({ route: 'mapTruthGrounded', prompt: 'Poster' }))).status).toBe(400)
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

  it('tells the model to follow the real map it was given', async () => {
    const response = await handler(request({
      route: 'screenshotGrounded', prompt: 'Civic print', sourceImageDataUrl: 'data:image/png;base64,aA==', mapSummary: '{"lock":"live"}',
      markerCount: 4,
    }))
    expect(response.status).toBe(200)
    const options = vi.mocked(generateImage).mock.calls[0][0]
    const prompt = options.prompt as { text: string; images: string[] }
    expect(prompt.text).toContain('real OpenStreetMap view')
    expect(prompt.text).toContain('Do not invent streets')
    // The markers already on the capture are evidence, not decoration.
    expect(prompt.text).toContain('coloured dots are real, verified locations')
    expect(prompt.text).toContain('Do not add markers of your own')
    // Markers drawn on the live map must survive into the poster.
    expect(prompt.text).toContain('keep every marker exactly where it sits')
    expect(prompt.images).toHaveLength(1)
    expect(options.size).toBe('1024x1536')
  })
})

describe('what the grounded route is allowed to name', () => {
  const grounded = (markerCount: number) => request({
    route: 'screenshotGrounded',
    prompt: 'Cafe terbaik di Bandung',
    sourceImageDataUrl: 'data:image/png;base64,aA==',
    mapSummary: '{"lock":"live"}',
    markerCount,
  })

  it('forbids naming any venue when nothing was verified', async () => {
    expect((await handler(grounded(0))).status).toBe(200)
    const prompt = vi.mocked(generateImage).mock.calls[0][0].prompt as { text: string }
    expect(prompt.text).toContain('must not name or pin any individual')
    expect(prompt.text).toContain('must not include a legend or numbered list of places')
  })

  it('asks for the legend to be built from the verified markers when there are some', async () => {
    expect((await handler(grounded(6))).status).toBe(200)
    const prompt = vi.mocked(generateImage).mock.calls[0][0].prompt as { text: string }
    expect(prompt.text).toContain('real, verified locations')
    expect(prompt.text).not.toContain('must not include a legend')
  })

  it('treats a missing count as nothing verified', async () => {
    await handler(request({
      route: 'screenshotGrounded', prompt: 'x',
      sourceImageDataUrl: 'data:image/png;base64,aA==', mapSummary: '{}',
    }))
    const prompt = vi.mocked(generateImage).mock.calls[0][0].prompt as { text: string }
    expect(prompt.text).toContain('must not name or pin any individual')
  })
})
