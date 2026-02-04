import * as React from 'react'
import { encodeFunctionData, type Hex } from 'viem'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { erc20Abi } from '../config/contracts'
import { parseContractError } from '../types/policy'

interface UseApprovalReturn {
  allowance: bigint
  isApproved: (amount: bigint) => boolean
  approve: (amount: bigint) => Promise<Hex>
  isLoading: boolean
  status: string
  error: string | null
  reset: () => void
}

export function useApproval(spender?: `0x${string}`): UseApprovalReturn {
  const { account } = useWallet()
  const { publicClient, bundlerClient, chainConfig } = useChain()

  const [allowance, setAllowance] = React.useState<bigint>(0n)
  const [isLoading, setIsLoading] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  // Fetch current allowance
  const fetchAllowance = React.useCallback(async () => {
    if (!publicClient || !account?.address || !spender) return

    try {
      const result = await publicClient.readContract({
        address: chainConfig.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address, spender],
      })
      setAllowance(result)
    } catch (err) {
      console.error('Failed to fetch allowance:', err)
    }
  }, [publicClient, account?.address, spender, chainConfig.usdc])

  // Fetch allowance on mount and when dependencies change
  React.useEffect(() => {
    fetchAllowance()
  }, [fetchAllowance])

  // Check if approved for amount
  const isApproved = React.useCallback(
    (amount: bigint) => allowance >= amount,
    [allowance]
  )

  // Approve spending
  const approve = React.useCallback(
    async (amount: bigint): Promise<Hex> => {
      if (!account || !bundlerClient || !spender) {
        throw new Error('Wallet not connected')
      }

      setIsLoading(true)
      setStatus('Approving...')
      setError(null)

      try {
        const callData = encodeFunctionData({
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, amount],
        })

        // Use paymaster for gas sponsorship
        // Arc's bundler requires minimum gas fees that the paymaster doesn't set correctly
        const opHash = await bundlerClient.sendUserOperation({
          account,
          calls: [{ to: chainConfig.usdc, data: callData }],
          paymaster: true,
          ...(chainConfig.minGasFees && {
            maxPriorityFeePerGas: chainConfig.minGasFees.maxPriorityFeePerGas,
            maxFeePerGas: chainConfig.minGasFees.maxFeePerGas,
          }),
        })

        setStatus('Waiting for confirmation...')

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({
          hash: opHash,
        })

        setStatus('Approved')

        // Refresh allowance
        await fetchAllowance()

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
    [account, bundlerClient, spender, chainConfig.usdc, fetchAllowance]
  )

  const reset = React.useCallback(() => {
    setStatus('')
    setError(null)
  }, [])

  return {
    allowance,
    isApproved,
    approve,
    isLoading,
    status,
    error,
    reset,
  }
}
