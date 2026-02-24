import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './useWallet'
import { useChain } from './useChain'
import { fetchMerchantCharges, type MerchantCharge } from '../lib/relayer'

interface UseMerchantChargesResult {
  charges: MerchantCharge[]
  total: number
  page: number
  isLoading: boolean
  error: string | null
  setPage: (page: number) => void
  refetch: () => void
}

export function useMerchantCharges(limit = 20): UseMerchantChargesResult {
  const { address } = useWallet()
  const { chainConfig } = useChain()
  const [charges, setCharges] = useState<MerchantCharge[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = useCallback(() => setRefreshKey((k) => k + 1), [])

  // Reset to page 1 when chain changes
  useEffect(() => {
    setPage(1)
  }, [chainConfig.chain.id])

  useEffect(() => {
    if (!address) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)
      try {
        const result = await fetchMerchantCharges(address!, chainConfig.chain.id, page, limit)
        if (!cancelled) {
          setCharges(result.charges)
          setTotal(result.total)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load charges')
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [address, chainConfig.chain.id, page, limit, refreshKey])

  return { charges, total, page, isLoading, error, setPage, refetch }
}
