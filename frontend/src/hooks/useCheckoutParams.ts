import * as React from 'react'
import type { CheckoutParams } from '../types/checkout'

function isValidAddress(value: string): value is `0x${string}` {
  return /^0x[a-fA-F0-9]{40}$/.test(value)
}

function isValidUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

interface UseCheckoutParamsReturn {
  params: CheckoutParams | null
  error: string | null
}

export function useCheckoutParams(): UseCheckoutParamsReturn {
  return React.useMemo(() => {
    const search = new URLSearchParams(window.location.search)

    const merchant = search.get('merchant')
    const metadataUrl = search.get('metadata_url')
    const successUrl = search.get('success_url')
    const cancelUrl = search.get('cancel_url')
    const amount = search.get('amount')
    const intervalStr = search.get('interval')
    const spendingCap = search.get('spending_cap') // optional

    if (!merchant || !metadataUrl || !successUrl || !cancelUrl || !amount || !intervalStr) {
      return {
        params: null,
        error: 'Missing required parameters: merchant, metadata_url, success_url, cancel_url, amount, interval',
      }
    }

    if (!isValidAddress(merchant)) {
      return { params: null, error: `Invalid merchant address: ${merchant}` }
    }

    if (!isValidUrl(metadataUrl)) {
      return { params: null, error: `Invalid metadata URL: ${metadataUrl}` }
    }

    if (!isValidUrl(successUrl)) {
      return { params: null, error: `Invalid success URL: ${successUrl}` }
    }

    if (!isValidUrl(cancelUrl)) {
      return { params: null, error: `Invalid cancel URL: ${cancelUrl}` }
    }

    const parsedAmount = parseFloat(amount)
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return { params: null, error: `Invalid amount: ${amount}` }
    }

    const interval = parseInt(intervalStr, 10)
    if (isNaN(interval) || interval <= 0) {
      return { params: null, error: `Invalid interval: ${intervalStr}` }
    }

    return {
      params: {
        merchant: merchant as `0x${string}`,
        metadataUrl,
        successUrl,
        cancelUrl,
        amount,
        interval,
        spendingCap: spendingCap || undefined,
      },
      error: null,
    }
  }, [])
}
