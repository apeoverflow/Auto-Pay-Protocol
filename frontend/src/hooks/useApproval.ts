import * as React from 'react'
import { type Hex } from 'viem'
import { useAccount } from 'wagmi'
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
  const { address } = useAccount()
  const { publicClient, walletClient, chainConfig } = useChain()

  const [allowance, setAllowance] = React.useState<bigint>(0n)
  const [isLoading, setIsLoading] = React.useState(false)
  const [status, setStatus] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  // Fetch current allowance
  const fetchAllowance = React.useCallback(async () => {
    if (!publicClient || !address || !spender) return

    try {
      const result = await publicClient.readContract({
        address: chainConfig.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, spender],
      })
      setAllowance(result)
    } catch (err) {
      console.error('Failed to fetch allowance:', err)
    }
  }, [publicClient, address, spender, chainConfig.usdc])

  React.useEffect(() => {
    fetchAllowance()
  }, [fetchAllowance])

  const isApproved = React.useCallback(
    (amount: bigint) => allowance >= amount,
    [allowance]
  )

  const approve = React.useCallback(
    async (amount: bigint): Promise<Hex> => {
      if (!address || !walletClient || !publicClient || !spender) {
        throw new Error('Wallet not connected')
      }

      setIsLoading(true)
      setStatus('Approving...')
      setError(null)

      try {
        const txHash = await walletClient.writeContract({
          address: chainConfig.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [spender, amount],
        })

        setStatus('Waiting for confirmation...')

        await publicClient.waitForTransactionReceipt({ hash: txHash })

        setStatus('Approved')
        await fetchAllowance()

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
    [address, walletClient, publicClient, spender, chainConfig.usdc, fetchAllowance]
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
