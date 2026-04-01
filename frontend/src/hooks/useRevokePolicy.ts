import * as React from 'react'
import { type Hex, type TransactionReceipt } from 'viem'
import { useAddress } from './useAddress'
import { useChain } from '../contexts/ChainContext'
import { PolicyManagerAbi } from '../config/deployments'
import { parseContractError } from '../types/policy'
import { isTempoBuild, useTempoWallet } from '../contexts/TempoWalletContext'
import { tempoRevokePolicy } from '../lib/tempo-api'

interface UseRevokePolicyReturn {
  revokePolicy: (policyId: `0x${string}`) => Promise<{ hash: Hex; receipt: TransactionReceipt }>
  hash: Hex | undefined
  status: string
  error: string | null
  isLoading: boolean
  reset: () => void
}

export function useRevokePolicy(): UseRevokePolicyReturn {
  const address = useAddress()
  const { walletClient, publicClient, chainConfig } = useChain()
  const tempoWallet = useTempoWallet()
  const isTempo = isTempoBuild()

  const [hash, setHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const revokePolicy = React.useCallback(
    async (policyId: `0x${string}`): Promise<{ hash: Hex; receipt: TransactionReceipt }> => {
      if (!address || !publicClient) {
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
        let txHash: Hex

        if (isTempo && tempoWallet.getAccessToken && tempoWallet.walletId && tempoWallet.address) {
          const token = await tempoWallet.getAccessToken()
          if (!token) throw new Error('Not authenticated')
          const result = await tempoRevokePolicy(token, tempoWallet.walletId, tempoWallet.address, policyId)
          txHash = result.hash as Hex
        } else {
          if (!walletClient) throw new Error('Wallet not connected')
          txHash = await walletClient.writeContract({
            address: chainConfig.policyManager,
            abi: PolicyManagerAbi,
            functionName: 'revokePolicy',
            args: [policyId],
          })
        }

        setHash(txHash)
        setStatus('Waiting for confirmation...')

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

        setStatus('Subscription cancelled')

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
