import { describe, expect, it, vi } from 'vitest'
import { LatestWriteQueue } from '../../src/main/ddc/latest-write-queue.js'

describe('LatestWriteQueue', () => {
  it('keeps only the latest pending value for each key', async () => {
    vi.useFakeTimers()
    const writes: Array<[string, number]> = []
    const queue = new LatestWriteQueue<string, number, number>(async (key, value) => {
      writes.push([key, value])
      return value
    }, 50)

    const first = queue.enqueue('brightness', 10)
    const second = queue.enqueue('brightness', 15)
    const contrast = queue.enqueue('contrast', 50)

    await vi.advanceTimersByTimeAsync(50)

    await expect(first).resolves.toBe(15)
    await expect(second).resolves.toBe(15)
    await expect(contrast).resolves.toBe(50)
    expect(writes).toEqual([
      ['brightness', 15],
      ['contrast', 50],
    ])
    vi.useRealTimers()
  })

  it('rejects every waiter when the native write fails', async () => {
    vi.useFakeTimers()
    const queue = new LatestWriteQueue<string, number, number>(async () => {
      throw new Error('DDC failed')
    }, 10)

    const first = queue.enqueue('brightness', 20)
    const second = queue.enqueue('brightness', 25)
    const assertions = Promise.all([
      expect(first).rejects.toThrow('DDC failed'),
      expect(second).rejects.toThrow('DDC failed'),
    ])
    await vi.advanceTimersByTimeAsync(10)

    await assertions
    vi.useRealTimers()
  })
})
