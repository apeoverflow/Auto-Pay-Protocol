import * as React from 'react'
import { useAccount, useSignMessage } from 'wagmi'

// Bump this when ToS changes materially to require re-acceptance
export const TERMS_VERSION = '1.0'

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || ''
const STORAGE_KEY_PREFIX = 'autopay_tos_accepted_'

function storageKey(address: string): string {
  return `${STORAGE_KEY_PREFIX}${address.toLowerCase()}`
}

interface StoredAcceptance {
  version: string
  timestamp: number
  signature: string
}

/** Synchronously check localStorage for a valid acceptance. */
function checkLocalAcceptance(address: string | undefined): boolean {
  if (!address) return false
  try {
    const stored = localStorage.getItem(storageKey(address))
    if (stored) {
      const parsed: StoredAcceptance = JSON.parse(stored)
      return parsed.version === TERMS_VERSION && !!parsed.signature
    }
  } catch {
    // Corrupt data
  }
  return false
}

interface TermsContextValue {
  hasAcceptedTerms: boolean
  isChecking: boolean
  isAccepting: boolean
  acceptTerms: () => Promise<void>
  termsVersion: string
}

const TermsContext = React.createContext<TermsContextValue | null>(null)

export function TermsProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()

  // Initialize synchronously from localStorage — prevents flash of ToS modal
  const [hasAccepted, setHasAccepted] = React.useState(() => checkLocalAcceptance(address))
  const [isChecking, setIsChecking] = React.useState(false)
  const [isAccepting, setIsAccepting] = React.useState(false)

  // When address changes, sync state immediately from localStorage,
  // then fall back to relayer check if localStorage has no record.
  React.useEffect(() => {
    if (!address) {
      setHasAccepted(false)
      return
    }

    // Synchronous localStorage check — covers the common case instantly
    if (checkLocalAcceptance(address)) {
      setHasAccepted(true)
      return
    }

    // Slow path: check relayer (for users who cleared localStorage or switched devices)
    if (!RELAYER_URL) {
      setHasAccepted(false)
      return
    }

    setIsChecking(true)
    fetch(`${RELAYER_URL}/terms/check/${address.toLowerCase()}?version=${TERMS_VERSION}`)
      .then(res => res.json())
      .then(data => {
        if (data.accepted) {
          // Re-populate localStorage cache
          const acceptance: StoredAcceptance = {
            version: TERMS_VERSION,
            timestamp: new Date(data.acceptedAt).getTime(),
            signature: 'verified-server',
          }
          localStorage.setItem(storageKey(address), JSON.stringify(acceptance))
          setHasAccepted(true)
        } else {
          setHasAccepted(false)
        }
      })
      .catch(() => {
        setHasAccepted(false)
      })
      .finally(() => setIsChecking(false))
  }, [address])

  const acceptTerms = React.useCallback(async () => {
    if (!address) throw new Error('Wallet not connected')

    setIsAccepting(true)
    try {
      const message = [
        'AutoPay Protocol — Terms Acceptance',
        '',
        `I have read and agree to the AutoPay Protocol Terms of Service (v${TERMS_VERSION}) and Privacy Policy.`,
        '',
        `Wallet: ${address}`,
        `Date: ${new Date().toISOString()}`,
      ].join('\n')

      const signature = await signMessageAsync({ message })

      // Save to relayer (authoritative record with signature verification)
      if (RELAYER_URL) {
        const res = await fetch(`${RELAYER_URL}/terms/accept`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            address: address.toLowerCase(),
            version: TERMS_VERSION,
            message,
            signature,
          }),
        })
        if (!res.ok) {
          const err = await res.json().catch(() => ({}))
          throw new Error((err as { error?: string }).error || 'Failed to record acceptance')
        }
      }

      // Cache in localStorage for fast subsequent loads
      const acceptance: StoredAcceptance = {
        version: TERMS_VERSION,
        timestamp: Date.now(),
        signature,
      }
      localStorage.setItem(storageKey(address), JSON.stringify(acceptance))
      setHasAccepted(true)
    } finally {
      setIsAccepting(false)
    }
  }, [address, signMessageAsync])

  const value = React.useMemo(
    () => ({
      hasAcceptedTerms: hasAccepted,
      isChecking,
      isAccepting,
      acceptTerms,
      termsVersion: TERMS_VERSION,
    }),
    [hasAccepted, isChecking, isAccepting, acceptTerms]
  )

  return <TermsContext.Provider value={value}>{children}</TermsContext.Provider>
}

export function useTerms() {
  const context = React.useContext(TermsContext)
  if (!context) {
    throw new Error('useTerms must be used within a TermsProvider')
  }
  return context
}
