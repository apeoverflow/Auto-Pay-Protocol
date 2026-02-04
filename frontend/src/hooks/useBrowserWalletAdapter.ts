import { useState, useEffect } from 'react'
import { createViemAdapterFromProvider, type ViemAdapter } from '@circle-fin/adapter-viem-v2'
import { useAccount } from 'wagmi'
import type { EIP1193Provider } from 'viem'

/**
 * Creates a Bridge Kit adapter from the connected browser wallet (MetaMask, etc.)
 * The adapter is used to sign and send transactions via Bridge Kit
 */
export function useBrowserWalletAdapter() {
  const { isConnected, connector } = useAccount()
  const [adapter, setAdapter] = useState<ViemAdapter | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function createAdapter() {
      if (!isConnected || !connector) {
        setAdapter(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // Get provider from the connected connector
        const provider = await connector.getProvider() as EIP1193Provider
        if (!provider) {
          throw new Error('No wallet provider found')
        }

        const newAdapter = await createViemAdapterFromProvider({ provider })
        setAdapter(newAdapter)
      } catch (err) {
        console.error('Failed to create adapter:', err)
        setError(err instanceof Error ? err.message : 'Failed to create adapter')
        setAdapter(null)
      } finally {
        setIsLoading(false)
      }
    }

    createAdapter()
  }, [isConnected, connector])

  return {
    adapter,
    isConnected: isConnected && !!adapter,
    isLoading,
    error,
  }
}
