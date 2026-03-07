import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname } from 'node:path'

/** Cached entry: policyId + optional signed Bearer token */
export interface StoreEntry {
  policyId: `0x${string}`
  /** Cached signed Bearer token (reused until near-expiry) */
  token?: string
  /** Token expiry as unix timestamp in seconds */
  tokenExpiry?: number
}

/**
 * Persistent store for agent subscription state (merchant → entry).
 *
 * Agents use this to recover subscriptions after restart without
 * relying on an external relayer. Also caches signed Bearer tokens
 * so the agent doesn't re-sign every request.
 */
export interface SubscriptionStore {
  get(merchant: string): Promise<StoreEntry | null>
  set(merchant: string, entry: StoreEntry): Promise<void>
  delete(merchant: string): Promise<void>
  all(): Promise<Map<string, StoreEntry>>
}

/** In-memory store (default). Subscriptions are lost on restart. */
export class MemoryStore implements SubscriptionStore {
  private map = new Map<string, StoreEntry>()

  async get(merchant: string) {
    return this.map.get(merchant.toLowerCase()) ?? null
  }

  async set(merchant: string, entry: StoreEntry) {
    this.map.set(merchant.toLowerCase(), entry)
  }

  async delete(merchant: string) {
    this.map.delete(merchant.toLowerCase())
  }

  async all() {
    return new Map(this.map)
  }
}

/**
 * File-backed store. Persists subscriptions as JSON so agents
 * can recover state after restart.
 *
 * @example
 * ```ts
 * const store = new FileStore('.autopay/subscriptions.json')
 * const fetchWithPay = wrapFetchWithSubscription(fetch, agent, { store })
 * ```
 */
export class FileStore implements SubscriptionStore {
  private cache: Map<string, StoreEntry> | null = null

  constructor(private readonly filePath: string) {}

  async get(merchant: string) {
    const map = await this.load()
    return map.get(merchant.toLowerCase()) ?? null
  }

  async set(merchant: string, entry: StoreEntry) {
    const map = await this.load()
    map.set(merchant.toLowerCase(), entry)
    await this.save(map)
  }

  async delete(merchant: string) {
    const map = await this.load()
    map.delete(merchant.toLowerCase())
    await this.save(map)
  }

  async all() {
    return new Map(await this.load())
  }

  private async load(): Promise<Map<string, StoreEntry>> {
    if (this.cache) return this.cache

    try {
      const raw = await readFile(this.filePath, 'utf-8')
      const obj = JSON.parse(raw) as Record<string, StoreEntry | string>
      const entries = new Map<string, StoreEntry>()
      for (const [key, value] of Object.entries(obj)) {
        // Handle legacy format (plain policyId string) gracefully
        if (typeof value === 'string') {
          entries.set(key, { policyId: value as `0x${string}` })
        } else {
          entries.set(key, value)
        }
      }
      this.cache = entries
    } catch {
      this.cache = new Map()
    }

    return this.cache
  }

  private async save(map: Map<string, StoreEntry>) {
    this.cache = map
    const obj = Object.fromEntries(map)
    await mkdir(dirname(this.filePath), { recursive: true })
    await writeFile(this.filePath, JSON.stringify(obj, null, 2) + '\n')
  }
}
