import { useState, useEffect, useCallback, useRef } from 'react'
import { useSignMessageCompat } from './useSignMessageCompat'
import { useWallet } from './useWallet'
import { fetchMerchantSubscribers, type MerchantSubscriber } from '../lib/relayer'

export function useMerchantSubscribers(planId?: string) {
  const { address } = useWallet()
  const { signMessageAsync } = useSignMessageCompat()
  const signRef = useRef(signMessageAsync)
  signRef.current = signMessageAsync

  const [subscribers, setSubscribers] = useState<MerchantSubscriber[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSubscribers = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    try {
      // Omit chainId to aggregate subscribers across all chains
      const data = await fetchMerchantSubscribers(address, signRef.current, undefined, planId, page, 50)
      setSubscribers(data.subscribers)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscribers')
    } finally {
      setIsLoading(false)
    }
  }, [address, planId, page])

  useEffect(() => {
    loadSubscribers()
  }, [loadSubscribers])

  return { subscribers, total, isLoading, error, page, setPage, refetch: loadSubscribers }
}
