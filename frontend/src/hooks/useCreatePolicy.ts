import * as React from 'react'
import { encodeFunctionData, decodeEventLog, type Hex } from 'viem'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { ArcPolicyManagerAbi } from '../config/deployments'
import { parseContractError, type CreatePolicyParams } from '../types/policy'

interface UseCreatePolicyReturn {
  createPolicy: (params: CreatePolicyParams) => Promise<`0x${string}`>
  policyId: `0x${string}` | undefined
  hash: Hex | undefined
  userOpHash: Hex | undefined
  status: string
  error: string | null
  isLoading: boolean
  reset: () => void
}

export function useCreatePolicy(): UseCreatePolicyReturn {
  const { account, fetchBalance } = useWallet()
  const { bundlerClient, chainConfig } = useChain()

  const [policyId, setPolicyId] = React.useState<`0x${string}`>()
  const [hash, setHash] = React.useState<Hex>()
  const [userOpHash, setUserOpHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const createPolicy = React.useCallback(
    async (params: CreatePolicyParams): Promise<`0x${string}`> => {
      if (!account || !bundlerClient) {
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
      setUserOpHash(undefined)

      try {
        const callData = encodeFunctionData({
          abi: ArcPolicyManagerAbi,
          functionName: 'createPolicy',
          args: [
            params.merchant,
            params.chargeAmount,
            params.interval,
            params.spendingCap,
            params.metadataUrl,
          ],
        })

        // Use paymaster for gas sponsorship
        // Arc's bundler requires minimum gas fees that the paymaster doesn't set correctly
        const opHash = await bundlerClient.sendUserOperation({
          account,
          calls: [{ to: chainConfig.policyManager, data: callData }],
          paymaster: true,
          ...(chainConfig.minGasFees && {
            maxPriorityFeePerGas: chainConfig.minGasFees.maxPriorityFeePerGas,
            maxFeePerGas: chainConfig.minGasFees.maxFeePerGas,
          }),
        })

        setUserOpHash(opHash)
        setStatus('Waiting for confirmation...')

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({
          hash: opHash,
        })

        setHash(receipt.transactionHash)

        // Parse PolicyCreated event from logs to get policyId
        let createdPolicyId: `0x${string}` | undefined
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({
              abi: ArcPolicyManagerAbi,
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

        // Refresh balance after policy creation (first charge happens)
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
    [account, bundlerClient, chainConfig.policyManager, fetchBalance]
  )

  const reset = React.useCallback(() => {
    setPolicyId(undefined)
    setHash(undefined)
    setUserOpHash(undefined)
    setStatus('')
    setError(null)
  }, [])

  return {
    createPolicy,
    policyId,
    hash,
    userOpHash,
    status,
    error,
    isLoading,
    reset,
  }
}
