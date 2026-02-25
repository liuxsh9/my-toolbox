// In-memory cache for window list and permissions.
// Window list: TTL 5s. Permissions: TTL 30s.

interface CacheEntry<T> {
  value: T
  expiresAt: number
}

function makeCache<T>(ttlMs: number) {
  let entry: CacheEntry<T> | null = null
  return {
    get(): T | null {
      if (entry && Date.now() < entry.expiresAt) return entry.value
      return null
    },
    set(value: T) {
      entry = { value, expiresAt: Date.now() + ttlMs }
    },
    invalidate() {
      entry = null
    },
  }
}

export const windowListCache = makeCache<object[]>(5_000)
export const permissionsCache = makeCache<{ accessibility: boolean; screenRecording: boolean }>(30_000)
