import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './useWallet'
import { listPlans, type PlanSummary } from '../lib/relayer'

export function useMerchantPlans(statusFilter?: string) {
  const { address } = useWallet()
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await listPlans(address, statusFilter)
      setPlans(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plans')
    } finally {
      setIsLoading(false)
    }
  }, [address, statusFilter])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { plans, isLoading, error, refetch: fetch }
}
