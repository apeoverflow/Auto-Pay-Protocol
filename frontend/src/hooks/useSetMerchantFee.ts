import * as React from 'react'
import { type Hex, type TransactionReceipt } from 'viem'
import { useAddress } from './useAddress'
import { useChain } from '../contexts/ChainContext'
import { PolicyManagerAbi } from '../config/deployments'
import { parseContractError } from '../types/policy'

interface UseSetMerchantFeeReturn {
  setMerchantFee: (merchant: `0x${string}`, feeBps: number) => Promise<{ hash: Hex; receipt: TransactionReceipt }>
  hash: Hex | undefined
  status: string
  error: string | null
  isLoading: boolean
  reset: () => void
}

export function useSetMerchantFee(): UseSetMerchantFeeReturn {
  const address = useAddress()
  const { walletClient, publicClient, chainConfig } = useChain()

  const [hash, setHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const setMerchantFee = React.useCallback(
    async (merchant: `0x${string}`, feeBps: number): Promise<{ hash: Hex; receipt: TransactionReceipt }> => {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      if (!chainConfig.policyManager) {
        throw new Error('Policy manager not deployed on this chain')
      }

      setIsLoading(true)
      setStatus('Setting merchant fee...')
      setError(null)
      setHash(undefined)

      try {
        const txHash = await walletClient.writeContract({
          address: chainConfig.policyManager,
          abi: PolicyManagerAbi,
          functionName: 'setMerchantFee',
          args: [merchant, BigInt(feeBps)],
        })

        setHash(txHash)
        setStatus('Waiting for confirmation...')

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

        setStatus('Merchant fee updated')

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
    setMerchantFee,
    hash,
    status,
    error,
    isLoading,
    reset,
  }
}
