import { describe, expect, it, vi } from 'vitest'
import { memo } from './memo'

describe('the latency cushion', () => {
  it('serves a remembered answer without asking again', async () => {
    const produce = vi.fn().mockResolvedValue({ ok: true, n: 1 })
    const key = `hit-${Math.random()}`
    await memo(key, produce, () => true)
    await memo(key, produce, () => true)
    expect(produce).toHaveBeenCalledTimes(1)
  })

  it('never remembers a refusal, so one bad moment does not linger', async () => {
    const produce = vi.fn()
      .mockResolvedValueOnce({ ok: false })
      .mockResolvedValueOnce({ ok: true, n: 2 })
    const key = `miss-${Math.random()}`

    expect(await memo(key, produce, (value) => (value as { ok: boolean }).ok)).toMatchObject({ ok: false })
    // The retry must reach the source rather than the stored failure.
    expect(await memo(key, produce, (value) => (value as { ok: boolean }).ok)).toMatchObject({ ok: true })
    expect(produce).toHaveBeenCalledTimes(2)
  })

  it('keeps separate answers for separate questions', async () => {
    const produce = vi.fn().mockResolvedValue({ ok: true })
    await memo(`a-${Math.random()}`, produce, () => true)
    await memo(`b-${Math.random()}`, produce, () => true)
    expect(produce).toHaveBeenCalledTimes(2)
  })
})
