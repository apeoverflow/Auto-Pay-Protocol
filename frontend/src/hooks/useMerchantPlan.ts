import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './useWallet'
import { getPlan, type PlanDetail } from '../lib/relayer'

export function useMerchantPlan(planId: string | null) {
  const { address } = useWallet()
  const [plan, setPlan] = useState<PlanDetail | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!address || !planId) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await getPlan(address, planId)
      setPlan(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan')
    } finally {
      setIsLoading(false)
    }
  }, [address, planId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { plan, isLoading, error, refetch: fetch }
}
