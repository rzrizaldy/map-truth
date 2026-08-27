import { describe, expect, it } from 'vitest'
import { GET, POST } from './osm-extract'

describe('osm-extract endpoint validation', () => {
  it('exposes a web-standard POST handler, not a Node default export', async () => {
    const response = await POST(new Request('http://localhost/api/osm-extract', {
      method: 'POST',
      body: 'not json',
    }))
    expect(response).toBeInstanceOf(Response)
    expect(response.status).toBe(400)
  })

  it('rejects non-POST requests', () => {
    expect(GET().status).toBe(405)
  })

  it('rejects oversized bboxes without calling Overpass', async () => {
    const response = await POST(new Request('http://localhost/api/osm-extract', {
      method: 'POST',
      body: JSON.stringify({ bbox: [-75, 40, -70, 45] }),
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'bbox_too_large' })
  })
})
