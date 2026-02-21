import * as React from 'react'
import { type Hex } from 'viem'
import { useAccount } from 'wagmi'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { PolicyManagerAbi } from '../config/deployments'
import { parseContractError } from '../types/policy'

interface UseChargeReturn {
  charge: (policyId: `0x${string}`) => Promise<Hex>
  canCharge: (policyId: `0x${string}`) => Promise<{ canCharge: boolean; reason: string }>
  hash: Hex | undefined
  status: string
  error: string | null
  isLoading: boolean
  reset: () => void
}

export function useCharge(): UseChargeReturn {
  const { address } = useAccount()
  const { fetchBalance } = useWallet()
  const { publicClient, walletClient, chainConfig } = useChain()

  const [hash, setHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const checkCanCharge = React.useCallback(
    async (policyId: `0x${string}`): Promise<{ canCharge: boolean; reason: string }> => {
      if (!publicClient || !chainConfig.policyManager) {
        return { canCharge: false, reason: 'Not connected' }
      }

      try {
        const result = await publicClient.readContract({
          address: chainConfig.policyManager,
          abi: PolicyManagerAbi,
          functionName: 'canCharge',
          args: [policyId],
        })

        const [canChargeResult, reason] = result as [boolean, string]
        return { canCharge: canChargeResult, reason }
      } catch (err) {
        console.error('Failed to check canCharge:', err)
        return { canCharge: false, reason: 'Failed to check' }
      }
    },
    [publicClient, chainConfig.policyManager]
  )

  const executeCharge = React.useCallback(
    async (policyId: `0x${string}`): Promise<Hex> => {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      if (!chainConfig.policyManager) {
        throw new Error('Policy manager not deployed on this chain')
      }

      setIsLoading(true)
      setStatus('Charging...')
      setError(null)
      setHash(undefined)

      try {
        const txHash = await walletClient.writeContract({
          address: chainConfig.policyManager,
          abi: PolicyManagerAbi,
          functionName: 'charge',
          args: [policyId],
        })

        setHash(txHash)
        setStatus('Waiting for confirmation...')

        await publicClient.waitForTransactionReceipt({ hash: txHash })

        setStatus('Charge successful')
        await fetchBalance()

        return txHash
      } catch (err) {
        const message = parseContractError(err)
        setError(message)
        setStatus(`Error: ${message}`)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [address, walletClient, publicClient, chainConfig.policyManager, fetchBalance]
  )

  const reset = React.useCallback(() => {
    setHash(undefined)
    setStatus('')
    setError(null)
  }, [])

  return {
    charge: executeCharge,
    canCharge: checkCanCharge,
    hash,
    status,
    error,
    isLoading,
    reset,
  }
}
