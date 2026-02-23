import { useState, useEffect } from 'react'
import { useWallet } from './useWallet'
import { useChain } from './useChain'
import { listPlans, fetchMerchantStats, type PlanSummary } from '../lib/relayer'

interface MerchantStats {
  plans: PlanSummary[]
  planCounts: { total: number; draft: number; active: number; archived: number }
  activeSubscribers: number
  totalRevenue: string
  chargeCount: number
  isLoading: boolean
}

export function useMerchantStats(): MerchantStats {
  const { address } = useWallet()
  const { chainConfig } = useChain()
  const [plans, setPlans] = useState<PlanSummary[]>([])
  const [activeSubscribers, setActiveSubscribers] = useState(0)
  const [totalRevenue, setTotalRevenue] = useState('0')
  const [chargeCount, setChargeCount] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!address) return
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        // Fetch plans from relayer
        const planData = await listPlans(address!).catch(() => [] as PlanSummary[])
        if (!cancelled) setPlans(planData)

        // Fetch subscriber count + revenue from relayer stats endpoint
        const stats = await fetchMerchantStats(address!, chainConfig.chain.id).catch(() => null)
        if (!cancelled && stats) {
          setActiveSubscribers(stats.activeSubscribers)
          setTotalRevenue(stats.totalRevenue)
          setChargeCount(stats.chargeCount)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [address, chainConfig.chain.id])

  const planCounts = {
    total: plans.length,
    draft: plans.filter(p => p.status === 'draft').length,
    active: plans.filter(p => p.status === 'active').length,
    archived: plans.filter(p => p.status === 'archived').length,
  }

  return { plans, planCounts, activeSubscribers, totalRevenue, chargeCount, isLoading }
}
