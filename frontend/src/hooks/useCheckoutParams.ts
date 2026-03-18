import * as React from 'react'
import type { CheckoutParams, CheckoutField, SubscriberFieldKey } from '../types/checkout'

const VALID_FIELD_KEYS: SubscriberFieldKey[] = ['email', 'name', 'discord', 'telegram', 'twitter', 'mobile']

function parseFields(raw: string | null): CheckoutField[] | undefined {
  if (!raw) return undefined
  const fields: CheckoutField[] = []
  for (const part of raw.split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const [key, flag] = trimmed.split(':')
    if (!VALID_FIELD_KEYS.includes(key as SubscriberFieldKey)) continue
    fields.push({ key: key as SubscriberFieldKey, required: flag === 'r' })
  }
  return fields.length > 0 ? fields : undefined
}

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
    if (typeof window === 'undefined') return { params: null, error: null }
    const search = new URLSearchParams(window.location.search)

    const merchant = search.get('merchant')
    const metadataUrl = search.get('metadata_url')
    const successUrl = search.get('success_url')
    const cancelUrl = search.get('cancel_url')
    const amount = search.get('amount')
    const intervalStr = search.get('interval')
    const spendingCap = search.get('spending_cap') // optional
    const ipfsMetadataUrl = search.get('ipfs_metadata_url') // optional fallback
    const fieldsRaw = search.get('fields') // optional: email:r,name:o,discord:r

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

    // Support both numeric seconds and string labels
    const labelToSeconds: Record<string, number> = {
      seconds: 1, minutes: 60, daily: 86400,
      weekly: 604800, biweekly: 1209600, monthly: 2592000,
      quarterly: 7776000, yearly: 31536000,
    }
    const interval = labelToSeconds[intervalStr] ?? parseInt(intervalStr, 10)
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
        ipfsMetadataUrl: ipfsMetadataUrl || undefined,
        fields: parseFields(fieldsRaw),
      },
      error: null,
    }
  }, [])
}
