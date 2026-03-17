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
  const [hasAccepted, setHasAccepted] = React.useState(false)
  const [isChecking, setIsChecking] = React.useState(false)
  const [isAccepting, setIsAccepting] = React.useState(false)

  // Check acceptance status when address changes
  // 1. Check localStorage (fast, instant UI)
  // 2. Verify with relayer (authoritative, background)
  React.useEffect(() => {
    if (!address) {
      setHasAccepted(false)
      return
    }

    // Fast path: check localStorage first
    try {
      const stored = localStorage.getItem(storageKey(address))
      if (stored) {
        const parsed: StoredAcceptance = JSON.parse(stored)
        if (parsed.version === TERMS_VERSION && parsed.signature) {
          setHasAccepted(true)
          return
        }
      }
    } catch {
      // Corrupt data — fall through to relayer check
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
        // Relayer unreachable — don't block the user if localStorage had nothing
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
