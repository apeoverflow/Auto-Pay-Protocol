import * as React from 'react'
import { encodeFunctionData, type Hex } from 'viem'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { ArcPolicyManagerAbi } from '../config/deployments'
import { parseContractError } from '../types/policy'

interface UseRevokePolicyReturn {
  revokePolicy: (policyId: `0x${string}`) => Promise<Hex>
  hash: Hex | undefined
  userOpHash: Hex | undefined
  status: string
  error: string | null
  isLoading: boolean
  reset: () => void
}

export function useRevokePolicy(): UseRevokePolicyReturn {
  const { account } = useWallet()
  const { bundlerClient, chainConfig } = useChain()

  const [hash, setHash] = React.useState<Hex>()
  const [userOpHash, setUserOpHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const revokePolicy = React.useCallback(
    async (policyId: `0x${string}`): Promise<Hex> => {
      if (!account || !bundlerClient) {
        throw new Error('Wallet not connected')
      }

      if (!chainConfig.policyManager) {
        throw new Error('Policy manager not deployed on this chain')
      }

      setIsLoading(true)
      setStatus('Cancelling subscription...')
      setError(null)
      setHash(undefined)
      setUserOpHash(undefined)

      try {
        const callData = encodeFunctionData({
          abi: ArcPolicyManagerAbi,
          functionName: 'revokePolicy',
          args: [policyId],
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
        setStatus('Subscription cancelled')

        return receipt.transactionHash
      } catch (err) {
        const message = parseContractError(err)
        setError(message)
        setStatus(`Error: ${message}`)
        throw err
      } finally {
        setIsLoading(false)
      }
    },
    [account, bundlerClient, chainConfig.policyManager]
  )

  const reset = React.useCallback(() => {
    setHash(undefined)
    setUserOpHash(undefined)
    setStatus('')
    setError(null)
  }, [])

  return {
    revokePolicy,
    hash,
    userOpHash,
    status,
    error,
    isLoading,
    reset,
  }
}
