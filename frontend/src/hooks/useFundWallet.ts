import { useState, useCallback } from 'react'
import { parseUnits } from 'viem'
import { useAccount, usePublicClient, useWalletClient } from 'wagmi'
import {
  TOKEN_MESSENGER_V2,
  TOKEN_MESSENGER_V2_ABI,
  ERC20_APPROVE_ABI,
  USDC_ADDRESSES,
  ARC_DOMAIN,
  addressToBytes32,
} from '../config/cctp'
import { USDC_DECIMALS } from '../config'

export interface FundWalletParams {
  sourceChainId: number
  amount: string // e.g., "10.00" (USDC amount with decimals)
  recipientAddress: string // Modular Wallet address on Arc
}

export interface FundWalletStepInfo {
  name: string
  status: 'pending' | 'success' | 'error'
  txHash?: string
}

export interface FundWalletResult {
  amount: string
  sourceAddress: string
  destinationAddress: string
  burnTxHash: string
  steps: FundWalletStepInfo[]
}

export interface UseFundWalletReturn {
  fundWallet: (params: FundWalletParams) => Promise<FundWalletResult>
  isLoading: boolean
  status: string
  error: string | null
  result: FundWalletResult | null
  reset: () => void
}

/**
 * Hook for funding a Modular Wallet on Arc from a browser wallet on another chain
 * Uses direct CCTP V2 calls (bypasses Bridge Kit which requires gas on destination)
 */
export function useFundWallet(): UseFundWalletReturn {
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()

  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<FundWalletResult | null>(null)

  const fundWallet = useCallback(async (params: FundWalletParams): Promise<FundWalletResult> => {
    if (!walletClient || !publicClient || !address) {
      throw new Error('Wallet not connected')
    }

    const usdcAddress = USDC_ADDRESSES[params.sourceChainId]
    if (!usdcAddress) {
      throw new Error('Unsupported source chain')
    }

    setIsLoading(true)
    setStatus('Preparing transfer...')
    setError(null)
    setResult(null)

    const steps: FundWalletStepInfo[] = []
    const amountInUnits = parseUnits(params.amount, USDC_DECIMALS)
    const mintRecipient = addressToBytes32(params.recipientAddress)

    try {
      // Step 1: Check allowance and approve if needed
      setStatus('Checking allowance...')

      const allowance = await publicClient.readContract({
        address: usdcAddress,
        abi: ERC20_APPROVE_ABI,
        functionName: 'allowance',
        args: [address, TOKEN_MESSENGER_V2],
      })

      if (allowance < amountInUnits) {
        setStatus('Approving USDC (sign in wallet)...')
        steps.push({ name: 'Approve USDC', status: 'pending' })

        const approveHash = await walletClient.writeContract({
          address: usdcAddress,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [TOKEN_MESSENGER_V2, amountInUnits],
        })

        setStatus('Waiting for approval...')
        await publicClient.waitForTransactionReceipt({ hash: approveHash })

        steps[steps.length - 1] = { name: 'Approve USDC', status: 'success', txHash: approveHash }
      }

      // Step 2: Call depositForBurn on TokenMessengerV2
      setStatus('Burning USDC (sign in wallet)...')
      steps.push({ name: 'Burn USDC', status: 'pending' })

      // CCTP V2 depositForBurn parameters:
      // - amount: USDC amount in smallest units
      // - destinationDomain: Arc = 26
      // - mintRecipient: recipient address as bytes32
      // - burnToken: USDC address on source chain
      // - destinationCaller: bytes32(0) = anyone can call receiveMessage
      // - maxFee: 0 = no fee limit (standard transfer)
      // - minFinalityThreshold: 0 = use default finality
      const burnHash = await walletClient.writeContract({
        address: TOKEN_MESSENGER_V2,
        abi: TOKEN_MESSENGER_V2_ABI,
        functionName: 'depositForBurn',
        args: [
          amountInUnits,
          ARC_DOMAIN,
          mintRecipient,
          usdcAddress,
          '0x0000000000000000000000000000000000000000000000000000000000000000', // destinationCaller
          BigInt(0), // maxFee (0 = standard transfer, no Fast Transfer fee)
          0, // minFinalityThreshold
        ],
      })

      setStatus('Waiting for burn confirmation...')
      await publicClient.waitForTransactionReceipt({ hash: burnHash })

      steps[steps.length - 1] = { name: 'Burn USDC', status: 'success', txHash: burnHash }

      // Success!
      const fundResult: FundWalletResult = {
        amount: params.amount,
        sourceAddress: address,
        destinationAddress: params.recipientAddress,
        burnTxHash: burnHash,
        steps,
      }

      setResult(fundResult)
      setStatus('Transfer initiated! USDC will arrive in ~15-20 minutes.')
      return fundResult
    } catch (err) {
      console.error('Fund wallet failed:', err)
      const message = err instanceof Error ? err.message : 'Transfer failed'
      setError(message)
      setStatus('')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [walletClient, publicClient, address])

  const reset = useCallback(() => {
    setIsLoading(false)
    setStatus('')
    setError(null)
    setResult(null)
  }, [])

  return {
    fundWallet,
    isLoading,
    status,
    error,
    result,
    reset,
  }
}
