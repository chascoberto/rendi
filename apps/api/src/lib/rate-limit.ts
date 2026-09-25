/** Limitador de intentos en memoria, por clave y ventana fija. Suficiente para un solo proceso. */
export class RateLimiter {
  private readonly hits = new Map<string, { count: number; resetAt: number }>()

  constructor(
    private readonly max: number,
    private readonly windowMs: number,
  ) {}

  /** ¿Se agotaron los intentos para esta clave? */
  isBlocked(key: string, now = Date.now()): boolean {
    const entry = this.hits.get(key)
    if (!entry) return false
    if (entry.resetAt <= now) {
      this.hits.delete(key)
      return false
    }
    return entry.count >= this.max
  }

  fail(key: string, now = Date.now()) {
    const entry = this.hits.get(key)
    if (!entry || entry.resetAt <= now) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs })
    } else {
      entry.count++
    }
  }

  reset(key: string) {
    this.hits.delete(key)
  }
}
