import * as React from 'react'
import { type Hex, type TransactionReceipt } from 'viem'
import { useAddress } from './useAddress'
import { useChain } from '../contexts/ChainContext'
import { PolicyManagerAbi } from '../config/deployments'
import { parseContractError } from '../types/policy'
import { isTempoBuild } from '../contexts/TempoWalletContext'

interface UseUpdateSpendingCapReturn {
  /** Set a policy's lifetime cap. `newCap` of 0n = unlimited. */
  updateSpendingCap: (
    policyId: `0x${string}`,
    newCap: bigint
  ) => Promise<{ hash: Hex; receipt: TransactionReceipt }>
  hash: Hex | undefined
  status: string
  error: string | null
  isLoading: boolean
  reset: () => void
}

export function useUpdateSpendingCap(): UseUpdateSpendingCapReturn {
  const address = useAddress()
  const { walletClient, publicClient, chainConfig } = useChain()
  const isTempo = isTempoBuild()

  const [hash, setHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const updateSpendingCap = React.useCallback(
    async (
      policyId: `0x${string}`,
      newCap: bigint
    ): Promise<{ hash: Hex; receipt: TransactionReceipt }> => {
      if (!address || !publicClient) {
        throw new Error('Wallet not connected')
      }
      if (!chainConfig.policyManager) {
        throw new Error('Policy manager not deployed on this chain')
      }
      if (isTempo) {
        throw new Error('Cap updates are not supported on this wallet yet')
      }
      if (!walletClient) {
        throw new Error('Wallet not connected')
      }

      setIsLoading(true)
      setStatus('Updating spending cap...')
      setError(null)
      setHash(undefined)

      try {
        const txHash = await walletClient.writeContract({
          address: chainConfig.policyManager,
          abi: PolicyManagerAbi,
          functionName: 'updateSpendingCap',
          args: [policyId, newCap],
        })

        setHash(txHash)
        setStatus('Waiting for confirmation...')

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

        setStatus('Spending cap updated')

        return { hash: txHash, receipt }
      } catch (err) {
        const message = parseContractError(err)
        setError(message)
        setStatus(`Error: ${message}`)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [address, walletClient, publicClient, chainConfig.policyManager, isTempo]
  )

  const reset = React.useCallback(() => {
    setHash(undefined)
    setStatus('')
    setError(null)
  }, [])

  return { updateSpendingCap, hash, status, error, isLoading, reset }
}
