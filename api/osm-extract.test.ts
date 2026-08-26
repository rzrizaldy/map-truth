import { describe, expect, it } from 'vitest'
import handler from './osm-extract'

describe('osm-extract endpoint validation', () => {
  it('rejects non-POST requests', async () => {
    const response = await handler(new Request('http://localhost/api/osm-extract'))
    expect(response.status).toBe(405)
  })

  it('rejects oversized bboxes without calling Overpass', async () => {
    const response = await handler(new Request('http://localhost/api/osm-extract', {
      method: 'POST',
      body: JSON.stringify({ bbox: [-75, 40, -70, 45] }),
    }))
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ error: 'bbox_too_large' })
  })
})
