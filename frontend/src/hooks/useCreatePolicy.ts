import * as React from 'react'
import { decodeEventLog, type Hex } from 'viem'
import { useAccount } from 'wagmi'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { PolicyManagerAbi } from '../config/deployments'
import { parseContractError, type CreatePolicyParams } from '../types/policy'

interface UseCreatePolicyReturn {
  createPolicy: (params: CreatePolicyParams) => Promise<`0x${string}`>
  policyId: `0x${string}` | undefined
  hash: Hex | undefined
  status: string
  error: string | null
  isLoading: boolean
  reset: () => void
}

export function useCreatePolicy(): UseCreatePolicyReturn {
  const { address } = useAccount()
  const { fetchBalance } = useWallet()
  const { walletClient, publicClient, chainConfig } = useChain()

  const [policyId, setPolicyId] = React.useState<`0x${string}`>()
  const [hash, setHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const createPolicy = React.useCallback(
    async (params: CreatePolicyParams): Promise<`0x${string}`> => {
      if (!address || !walletClient || !publicClient) {
        throw new Error('Wallet not connected')
      }

      if (!chainConfig.policyManager) {
        throw new Error('Policy manager not deployed on this chain')
      }

      setIsLoading(true)
      setStatus('Creating subscription...')
      setError(null)
      setPolicyId(undefined)
      setHash(undefined)

      try {
        const txHash = await walletClient.writeContract({
          address: chainConfig.policyManager,
          abi: PolicyManagerAbi,
          functionName: 'createPolicy',
          args: [
            params.merchant,
            params.chargeAmount,
            params.interval,
            params.spendingCap,
            params.metadataUrl,
          ],
        })

        setHash(txHash)
        setStatus('Waiting for confirmation...')

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

        // Parse PolicyCreated event from logs to get policyId
        let createdPolicyId: `0x${string}` | undefined
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: PolicyManagerAbi,
              data: log.data,
              topics: log.topics,
            })
            if (decoded.eventName === 'PolicyCreated' && decoded.args) {
              const args = decoded.args as unknown as { policyId: `0x${string}` }
              createdPolicyId = args.policyId
              break
            }
          } catch {
            // Not the event we're looking for
          }
        }

        if (!createdPolicyId) {
          throw new Error('Policy created but could not parse policyId from events')
        }

        setPolicyId(createdPolicyId)
        setStatus('Subscription created')

        await fetchBalance()

        return createdPolicyId
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
    setPolicyId(undefined)
    setHash(undefined)
    setStatus('')
    setError(null)
  }, [])

  return {
    createPolicy,
    policyId,
    hash,
    status,
    error,
    isLoading,
    reset,
  }
}
