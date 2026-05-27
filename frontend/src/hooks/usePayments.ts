import { useState, useEffect } from 'react'
import { useWallet } from './useWallet'
import { getPayments, type PaymentRecord } from '../lib/relayer'

export function usePayments() {
  const { address } = useWallet()
  const [payments, setPayments] = useState<PaymentRecord[]>([])
  const [total, setTotal] = useState(0)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!address) { setIsLoading(false); return }
    let cancelled = false
    setIsLoading(true)

    getPayments(address)
      .catch(() => null)
      .then((result) => {
        if (cancelled) return
        if (result) {
          setPayments(result.payments)
          setTotal(result.total)
        }
        setIsLoading(false)
      })

    return () => { cancelled = true }
  }, [address])

  return { payments, total, isLoading }
}
