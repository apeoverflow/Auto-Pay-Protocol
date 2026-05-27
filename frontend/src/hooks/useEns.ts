import { useState, useEffect } from 'react'
import { createPublicClient, http } from 'viem'
import { mainnet } from 'viem/chains'
import { normalize } from 'viem/ens'

/**
 * Shared mainnet client for ENS resolution.
 * Uses free public RPC — ENS only lives on mainnet.
 */
const mainnetClient = createPublicClient({
  chain: mainnet,
  transport: http(),
})

/**
 * In-memory ENS cache shared across all component instances.
 * Persists for the lifetime of the tab — avoids redundant RPC calls.
 */
interface EnsCacheEntry {
  name: string | null
  avatar: string | null
  resolved: boolean
}

const ensCache = new Map<string, EnsCacheEntry>()
const pendingResolves = new Map<string, Promise<EnsCacheEntry>>()

async function resolveEns(address: string): Promise<EnsCacheEntry> {
  const key = address.toLowerCase()

  // Return cached
  const cached = ensCache.get(key)
  if (cached) return cached

  // Deduplicate concurrent requests for the same address
  const pending = pendingResolves.get(key)
  if (pending) return pending

  const promise = (async (): Promise<EnsCacheEntry> => {
    try {
      const name = await mainnetClient.getEnsName({ address: address as `0x${string}` })

      let avatar: string | null = null
      if (name) {
        try {
          avatar = await mainnetClient.getEnsAvatar({ name: normalize(name) })
        } catch {
          // Avatar resolution can fail
        }
      }

      const entry: EnsCacheEntry = { name: name ?? null, avatar, resolved: true }
      ensCache.set(key, entry)
      return entry
    } catch {
      const entry: EnsCacheEntry = { name: null, avatar: null, resolved: true }
      ensCache.set(key, entry)
      return entry
    } finally {
      pendingResolves.delete(key)
    }
  })()

  pendingResolves.set(key, promise)
  return promise
}

/**
 * Resolve ENS name + avatar for an Ethereum address.
 * Uses an in-memory cache to avoid redundant mainnet RPC calls.
 */
export function useEnsLookup(address: string | undefined) {
  const [name, setName] = useState<string | null>(null)
  const [avatar, setAvatar] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!address) return

    const key = address.toLowerCase()
    const cached = ensCache.get(key)
    if (cached) {
      setName(cached.name)
      setAvatar(cached.avatar)
      return
    }

    let cancelled = false
    setIsLoading(true)

    resolveEns(address).then((entry) => {
      if (!cancelled) {
        setName(entry.name)
        setAvatar(entry.avatar)
        setIsLoading(false)
      }
    })

    return () => { cancelled = true }
  }, [address])

  return { name, avatar, isLoading }
}

/**
 * Get a display-friendly name for an address.
 * Returns ENS name if available, otherwise truncated address.
 */
export function useDisplayName(address: string | undefined) {
  const { name, avatar, isLoading } = useEnsLookup(address)
  const truncated = address ? `${address.slice(0, 6)}...${address.slice(-4)}` : ''
  return {
    displayName: name || truncated,
    ensName: name,
    ensAvatar: avatar,
    isEns: !!name,
    isLoading,
  }
}
