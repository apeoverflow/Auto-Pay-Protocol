import * as React from 'react'
import { useAccount, useSignMessage } from 'wagmi'

// Bump this when ToS changes materially to require re-acceptance
export const TERMS_VERSION = '1.0'

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
  isAccepting: boolean
  acceptTerms: () => Promise<void>
  termsVersion: string
}

const TermsContext = React.createContext<TermsContextValue | null>(null)

export function TermsProvider({ children }: { children: React.ReactNode }) {
  const { address } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const [hasAccepted, setHasAccepted] = React.useState(false)
  const [isAccepting, setIsAccepting] = React.useState(false)

  // Check localStorage for existing acceptance when address changes
  React.useEffect(() => {
    if (!address) {
      setHasAccepted(false)
      return
    }

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
      // Corrupt data — require re-acceptance
    }
    setHasAccepted(false)
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
      isAccepting,
      acceptTerms,
      termsVersion: TERMS_VERSION,
    }),
    [hasAccepted, isAccepting, acceptTerms]
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
