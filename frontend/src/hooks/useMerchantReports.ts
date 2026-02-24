import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './useWallet'
import { useChain } from './useChain'
import { fetchMerchantReports, type MerchantReport } from '../lib/relayer'

export type { MerchantReport }

interface UseMerchantReportsResult {
  reports: MerchantReport[]
  isLoading: boolean
  error: string | null
  refetch: () => void
}

export function useMerchantReports(): UseMerchantReportsResult {
  const { address } = useWallet()
  const { chainConfig } = useChain()
  const [reports, setReports] = useState<MerchantReport[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Reset when chain changes
  useEffect(() => {
    setReports([])
  }, [chainConfig.chain.id])

  useEffect(() => {
    if (!address) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const data = await fetchMerchantReports(address!, chainConfig.chain.id)
        if (!cancelled) {
          setReports(data)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load reports')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [address, chainConfig.chain.id, refreshKey])

  return { reports, isLoading, error, refetch }
}
