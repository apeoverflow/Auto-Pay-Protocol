import * as React from 'react'

export type AppMode = 'subscriber' | 'merchant'

interface MerchantModeContextValue {
  mode: AppMode
  setMode: (mode: AppMode) => void
  isMerchant: boolean
}

const MerchantModeContext = React.createContext<MerchantModeContextValue | null>(null)

function getInitialMode(): AppMode {
  return window.location.pathname.startsWith('/merchant') ? 'merchant' : 'subscriber'
}

export function MerchantModeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = React.useState<AppMode>(getInitialMode)

  const value = React.useMemo<MerchantModeContextValue>(
    () => ({
      mode,
      setMode,
      isMerchant: mode === 'merchant',
    }),
    [mode],
  )

  return (
    <MerchantModeContext.Provider value={value}>
      {children}
    </MerchantModeContext.Provider>
  )
}

export function useMerchantModeContext() {
  const ctx = React.useContext(MerchantModeContext)
  if (!ctx) throw new Error('useMerchantModeContext must be used within MerchantModeProvider')
  return ctx
}
