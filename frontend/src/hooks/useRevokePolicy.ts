import * as React from 'react'
import { type Hex } from 'viem'
import { useAccount } from 'wagmi'
import { useChain } from '../contexts/ChainContext'
import { PolicyManagerAbi } from '../config/deployments'
import { parseContractError } from '../types/policy'

interface UseRevokePolicyReturn {
  revokePolicy: (policyId: `0x${string}`) => Promise<Hex>
  hash: Hex | undefined
  status: string
  error: string | null
  isLoading: boolean
  reset: () => void
}

export function useRevokePolicy(): UseRevokePolicyReturn {
  const { address } = useAccount()
  const { walletClient, publicClient, chainConfig } = useChain()

  const [hash, setHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const revokePolicy = React.useCallback(
    async (policyId: `0x${string}`): Promise<Hex> => {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      if (!chainConfig.policyManager) {
        throw new Error('Policy manager not deployed on this chain')
      }

      setIsLoading(true)
      setStatus('Cancelling subscription...')
      setError(null)
      setHash(undefined)

      try {
        const txHash = await walletClient.writeContract({
          address: chainConfig.policyManager,
          abi: PolicyManagerAbi,
          functionName: 'revokePolicy',
          args: [policyId],
        })

        setHash(txHash)
        setStatus('Waiting for confirmation...')

        await publicClient.waitForTransactionReceipt({ hash: txHash })

        setStatus('Subscription cancelled')

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
    [address, walletClient, publicClient, chainConfig.policyManager]
  )

  const reset = React.useCallback(() => {
    setHash(undefined)
    setStatus('')
    setError(null)
  }, [])

  return {
    revokePolicy,
    hash,
    status,
    error,
    isLoading,
    reset,
  }
}
