import { useState, useEffect, useCallback } from 'react'
import { useSignMessage } from 'wagmi'
import { useWallet } from './useWallet'
import { fetchMerchantSubscribers, type MerchantSubscriber } from '../lib/relayer'
import { CHAIN_CONFIGS, DEFAULT_CHAIN } from '../config/chains'

export function useMerchantSubscribers(planId?: string) {
  const { address } = useWallet()
  const { signMessageAsync } = useSignMessage()
  const [subscribers, setSubscribers] = useState<MerchantSubscriber[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const chainId = CHAIN_CONFIGS[DEFAULT_CHAIN].chain.id

  const loadSubscribers = useCallback(async () => {
    if (!address) return
    setIsLoading(true)
    setError(null)
    try {
      const data = await fetchMerchantSubscribers(address, signMessageAsync, chainId, planId, page, 50)
      setSubscribers(data.subscribers)
      setTotal(data.total)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscribers')
    } finally {
      setIsLoading(false)
    }
  }, [address, signMessageAsync, chainId, planId, page])

  useEffect(() => {
    loadSubscribers()
  }, [loadSubscribers])

  return { subscribers, total, isLoading, error, page, setPage, refetch: loadSubscribers }
}
