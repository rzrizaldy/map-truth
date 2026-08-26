import { generateImage } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import handler from './generate-comparison'

vi.mock('ai', () => ({
  generateImage: vi.fn(),
  NoImageGeneratedError: { isInstance: () => false },
}))

beforeEach(() => {
  vi.mocked(generateImage).mockReset()
})

describe('GPT Image comparison endpoint validation', () => {
  it('rejects non-POST requests without calling the model', async () => {
    const response = await handler(new Request('http://localhost/api/generate-comparison'))
    expect(response.status).toBe(405)
    expect(await response.json()).toEqual({ error: 'method_not_allowed' })
  })

  it('requires a real PNG source screenshot', async () => {
    const response = await handler(new Request('http://localhost/api/generate-comparison', {
      method: 'POST',
      body: JSON.stringify({ prompt: 'Jakarta poster', sourceImageDataUrl: 'not-an-image' }),
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: 'valid_source_screenshot_required' })
  })

  it('makes three gpt-image-2 calls and reserves geography for MapTruth', async () => {
    vi.mocked(generateImage).mockResolvedValue({ image: { mediaType: 'image/png', base64: 'aW1hZ2U=' } } as never)
    const response = await handler(new Request('http://localhost/api/generate-comparison', {
      method: 'POST',
      body: JSON.stringify({
        prompt: 'Editorial public-information poster',
        sourceImageDataUrl: 'data:image/png;base64,aA==',
        mapSummary: 'Central Jakarta, 626 source-backed features',
      }),
    }))
    expect(response.status).toBe(200)
    expect(generateImage).toHaveBeenCalledTimes(3)
    for (const [options] of vi.mocked(generateImage).mock.calls) {
      expect(options.model).toBe('openai/gpt-image-2')
      expect(options.size).toBe('1024x1536')
    }
    const artLayerPrompt = vi.mocked(generateImage).mock.calls[2][0].prompt
    expect(String(artLayerPrompt)).toContain('Do not draw roads, rivers, routes, boundaries, maps, labels')
  })
})
