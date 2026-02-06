import { useState, useEffect, useRef } from 'react'

export interface PolicyMetadata {
  version?: string
  plan?: {
    name?: string
    description?: string
    tier?: string
    features?: string[]
  }
  merchant?: {
    name?: string
    logo?: string
    website?: string
    supportEmail?: string
    termsUrl?: string
    privacyUrl?: string
  }
  display?: {
    color?: string
    badge?: string
    icon?: string
  }
}

// Module-level cache shared across all hook instances
const metadataCache = new Map<string, PolicyMetadata>()
const failedUrls = new Set<string>()

// Resolve relative paths (e.g. "/logos/img.png") against the metadata URL origin
function resolveMetadataUrls(metadata: PolicyMetadata, fetchedFrom: string): PolicyMetadata {
  if (!metadata.merchant?.logo) return metadata
  const logo = metadata.merchant.logo
  // Already absolute
  if (logo.startsWith('http://') || logo.startsWith('https://')) return metadata
  try {
    const origin = new URL(fetchedFrom).origin
    return {
      ...metadata,
      merchant: {
        ...metadata.merchant,
        logo: `${origin}${logo.startsWith('/') ? '' : '/'}${logo}`,
      },
    }
  } catch {
    return metadata
  }
}

/**
 * Fetches and caches policy metadata from a metadataUrl.
 * Returns null if no URL, fetch fails, or JSON is invalid.
 */
export function useMetadata(metadataUrl: string | undefined | null): {
  metadata: PolicyMetadata | null
  isLoading: boolean
} {
  const [metadata, setMetadata] = useState<PolicyMetadata | null>(
    metadataUrl && metadataCache.has(metadataUrl) ? metadataCache.get(metadataUrl)! : null
  )
  const [isLoading, setIsLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    const url = metadataUrl || null

    if (!url || failedUrls.has(url)) {
      setMetadata(null)
      setIsLoading(false)
      return
    }

    // Already cached
    if (metadataCache.has(url)) {
      setMetadata(metadataCache.get(url)!)
      setIsLoading(false)
      return
    }

    // Fetch
    const controller = new AbortController()
    abortRef.current = controller
    setIsLoading(true)

    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        return res.json()
      })
      .then((json: PolicyMetadata) => {
        const resolved = resolveMetadataUrls(json, url)
        metadataCache.set(url, resolved)
        setMetadata(resolved)
      })
      .catch((err) => {
        if (err.name !== 'AbortError') {
          failedUrls.add(url)
          setMetadata(null)
        }
      })
      .finally(() => {
        setIsLoading(false)
      })

    return () => {
      controller.abort()
    }
  }, [metadataUrl])

  return { metadata, isLoading }
}

/**
 * Batch hook: fetches metadata for multiple policies at once.
 * Returns a map of metadataUrl -> PolicyMetadata.
 */
export function useMetadataBatch(
  metadataUrls: (string | undefined | null)[]
): Map<string, PolicyMetadata> {
  const [results, setResults] = useState<Map<string, PolicyMetadata>>(new Map())

  useEffect(() => {
    const urlsToFetch = metadataUrls.filter(
      (url): url is string => !!url && !metadataCache.has(url) && !failedUrls.has(url)
    )
    const uniqueUrls = [...new Set(urlsToFetch)]

    // Build initial map from cache
    const cached = new Map<string, PolicyMetadata>()
    for (const url of metadataUrls) {
      if (url && metadataCache.has(url)) {
        cached.set(url, metadataCache.get(url)!)
      }
    }
    if (cached.size > 0) {
      setResults(cached)
    }

    if (uniqueUrls.length === 0) return

    let cancelled = false

    Promise.allSettled(
      uniqueUrls.map((url) =>
        fetch(url)
          .then((res) => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            return res.json()
          })
          .then((json: PolicyMetadata) => {
            const resolved = resolveMetadataUrls(json, url)
            metadataCache.set(url, resolved)
            return { url, data: resolved }
          })
          .catch(() => {
            failedUrls.add(url)
            return null
          })
      )
    ).then(() => {
      if (cancelled) return
      const next = new Map<string, PolicyMetadata>()
      for (const url of metadataUrls) {
        if (url && metadataCache.has(url)) {
          next.set(url, metadataCache.get(url)!)
        }
      }
      setResults(next)
    })

    return () => {
      cancelled = true
    }
  }, [metadataUrls.join(',')])

  return results
}
