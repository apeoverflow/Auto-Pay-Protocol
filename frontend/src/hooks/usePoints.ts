import { useState, useEffect, useCallback } from 'react'
import { useWallet } from './useWallet'
import {
  fetchPointsLeaderboard,
  fetchPointsBalance,
  fetchPointsActions,
  type PointsLeaderboardResponse,
  type PointsBalanceResponse,
  type PointsActionDef,
} from '../lib/relayer'

// ── Leaderboard Hook ─────────────────────────────────────────

export function useLeaderboard(period: 'all' | 'monthly' | 'weekly' = 'all', page = 1) {
  const [data, setData] = useState<PointsLeaderboardResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      const result = await fetchPointsLeaderboard(period, page, 10).catch(() => null)
      if (result) setData(result)
    } finally {
      setIsLoading(false)
    }
  }, [period, page])

  useEffect(() => {
    let cancelled = false
    fetchData().then(() => { if (cancelled) return })
    return () => { cancelled = true }
  }, [fetchData])

  return { data, isLoading, refetch: fetchData }
}

// ── Points Balance Hook ──────────────────────────────────────

export function usePointsBalance() {
  const { address } = useWallet()
  const [data, setData] = useState<PointsBalanceResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!address) { setIsLoading(false); return }
    let cancelled = false

    async function load() {
      setIsLoading(true)
      try {
        const result = await fetchPointsBalance(address!).catch(() => null)
        if (!cancelled && result) setData(result)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [address])

  return { data, isLoading }
}

// ── Points Actions Hook ──────────────────────────────────────

export function usePointsActions() {
  const [actions, setActions] = useState<PointsActionDef[]>([])
  const [tiers, setTiers] = useState<{ name: string; threshold: number; color: string }[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const result = await fetchPointsActions().catch(() => null)
        if (!cancelled && result) {
          setActions(result.actions)
          setTiers(result.tiers)
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  return { actions, tiers, isLoading }
}
