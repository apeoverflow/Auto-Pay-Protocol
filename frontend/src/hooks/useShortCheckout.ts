import { useState, useEffect } from 'react'
import { resolveCheckoutLink, resolveCheckoutLinkFromUrl } from '../lib/relayer'
import type { CheckoutParams, CheckoutField, SubscriberFieldKey } from '../types/checkout'

const VALID_FIELD_KEYS: SubscriberFieldKey[] = ['email', 'name', 'discord', 'telegram', 'twitter', 'mobile']

function parseFields(raw: string | undefined): CheckoutField[] | undefined {
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

interface UseShortCheckoutReturn {
  params: CheckoutParams | null
  error: string | null
  isLoading: boolean
  isCustomRelayer: boolean
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSSRCheckoutData(): any {
  if (typeof window === 'undefined') return null
  return (window as any).__SSR_CHECKOUT_DATA__ ?? null
}

export function useShortCheckout(): UseShortCheckoutReturn {
  const [params, setParams] = useState<CheckoutParams | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isCustomRelayer, setIsCustomRelayer] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') { setIsLoading(false); return }
    const pathname = window.location.pathname
    if (!pathname.startsWith('/pay/')) {
      setIsLoading(false)
      return
    }
    const shortId = pathname.slice('/pay/'.length)
    if (!shortId) {
      setError('Missing short link ID')
      setIsLoading(false)
      return
    }

    // Use server-prefetched data if available (injected by SSR handler)
    const ssrData = getSSRCheckoutData()
    if (ssrData?.link) {
      const data = ssrData.link
      const defaultUrl = `${window.location.origin}/dashboard`
      setParams({
        merchant: data.merchant as `0x${string}`,
        metadataUrl: data.metadataUrl,
        amount: String(data.amount),
        interval: data.interval,
        spendingCap: data.spendingCap ? String(data.spendingCap) : undefined,
        ipfsMetadataUrl: data.ipfsMetadataUrl ?? undefined,
        successUrl: data.successUrl || defaultUrl,
        cancelUrl: data.cancelUrl || defaultUrl,
        fields: parseFields(data.fields),
      })
      setIsLoading(false)
      // Clear the SSR data so it's not reused on client navigation
      delete (window as any).__SSR_CHECKOUT_DATA__
      return
    }

    // Support custom relayer links: /pay/{shortId}?relayer=https://custom-relayer.example.com
    const searchParams = new URLSearchParams(window.location.search)
    const customRelayerUrl = searchParams.get('relayer')

    if (customRelayerUrl) setIsCustomRelayer(true)
    const resolvePromise = customRelayerUrl
      ? resolveCheckoutLinkFromUrl(customRelayerUrl, shortId)
      : resolveCheckoutLink(shortId)

    resolvePromise
      .then((data) => {
        const defaultUrl = `${window.location.origin}/dashboard`
        setParams({
          merchant: data.merchant as `0x${string}`,
          metadataUrl: data.metadataUrl,
          amount: String(data.amount),
          interval: data.interval,
          spendingCap: data.spendingCap ? String(data.spendingCap) : undefined,
          ipfsMetadataUrl: data.ipfsMetadataUrl ?? undefined,
          successUrl: data.successUrl || defaultUrl,
          cancelUrl: data.cancelUrl || defaultUrl,
          fields: parseFields(data.fields),
        })
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load checkout link')
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  return { params, error, isLoading, isCustomRelayer }
}
