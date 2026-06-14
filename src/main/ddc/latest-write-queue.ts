interface PendingWrite<K, V, R> {
  key: K
  value: V
  waiters: Array<{
    resolve: (result: R) => void
    reject: (error: unknown) => void
  }>
}

export class LatestWriteQueue<K, V, R> {
  private readonly pending = new Map<K, PendingWrite<K, V, R>>()
  private timer: NodeJS.Timeout | null = null
  private running = false

  constructor(
    private readonly write: (key: K, value: V) => Promise<R>,
    private readonly debounceMs = 60
  ) {}

  enqueue(key: K, value: V): Promise<R> {
    return new Promise<R>((resolve, reject) => {
      const existing = this.pending.get(key)
      if (existing) {
        existing.value = value
        existing.waiters.push({ resolve, reject })
      } else {
        this.pending.set(key, {
          key,
          value,
          waiters: [{ resolve, reject }],
        })
      }

      this.schedule()
    })
  }

  private schedule(): void {
    if (this.running) {
      return
    }

    if (this.timer) {
      clearTimeout(this.timer)
    }
    this.timer = setTimeout(() => {
      this.timer = null
      void this.drain()
    }, this.debounceMs)
  }

  private async drain(): Promise<void> {
    if (this.running) {
      return
    }

    this.running = true
    try {
      while (this.pending.size > 0) {
        const writes = [...this.pending.values()]
        this.pending.clear()

        for (const pending of writes) {
          try {
            const result = await this.write(pending.key, pending.value)
            for (const waiter of pending.waiters) {
              waiter.resolve(result)
            }
          } catch (error) {
            for (const waiter of pending.waiters) {
              waiter.reject(error)
            }
          }
        }
      }
    } finally {
      this.running = false
      if (this.pending.size > 0) {
        this.schedule()
      }
    }
  }
}
