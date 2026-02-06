import { useState, useCallback } from 'react'
import { parseUnits, maxUint256, zeroAddress, encodeFunctionData, erc20Abi } from 'viem'
import { useSignTypedData, useAccount, usePublicClient, useWalletClient } from 'wagmi'
import {
  GATEWAY_API_URL,
  GATEWAY_MINTER_ABI,
  GATEWAY_WALLET_ABI,
  ERC20_ABI,
  EIP712_DOMAIN,
  EIP712_TYPES,
  arcTestnetConfig,
  addressToBytes32,
  randomSalt,
  type GatewaySourceChain,
} from '../config/gateway'
import { useChain } from '../contexts/ChainContext'
import { useWallet } from '../hooks'
import { USDC_DECIMALS } from '../config'

// Chain-specific wait times (in ms) for Gateway indexer to pick up deposit
// L2s need longer waits due to L1 finality requirements
const CHAIN_WAIT_TIMES: Record<number, { waitMs: number; name: string }> = {
  0:  { waitMs: 5_000,   name: 'Ethereum Sepolia' },   // L1 - fast
  1:  { waitMs: 5_000,   name: 'Avalanche Fuji' },     // L1 - fast
  6:  { waitMs: 30_000,  name: 'Base Sepolia' },       // L2 - needs L1 finality
  13: { waitMs: 8_000,   name: 'Sonic Testnet' },      // L1 - fast
  14: { waitMs: 30_000,  name: 'World Chain' },        // L2 - needs L1 finality
  16: { waitMs: 5_000,   name: 'Sei Atlantic' },       // L1 - fast
  19: { waitMs: 5_000,   name: 'HyperEVM' },           // L1 - fast
}

const DEFAULT_WAIT = { waitMs: 15_000, name: 'Unknown Chain' }

export interface GatewayTransferParams {
  sourceChain: GatewaySourceChain
  amount: string // e.g., "10.00"
  recipientAddress: `0x${string}` // Modular Wallet address on Arc
}

export interface GatewayTransferResult {
  amount: string
  sourceAddress: string
  destinationAddress: string
  mintTxHash?: string
}

/**
 * Hook for cross-chain USDC transfers using Circle Gateway
 *
 * Flow:
 * 1. Approve GatewayWallet to spend USDC (if needed)
 * 2. Deposit USDC into GatewayWallet (creates unified balance)
 * 3. Sign EIP-712 burn intent with MetaMask
 * 4. Gateway API validates and returns attestation
 * 5. Modular Wallet calls gatewayMint on Arc (paymaster covers gas)
 */
export function useGatewayTransfer() {
  const { address } = useAccount()
  const { signTypedDataAsync } = useSignTypedData()
  const publicClient = usePublicClient()
  const { data: walletClient } = useWalletClient()
  const { bundlerClient, chainConfig } = useChain()
  const { account } = useWallet()

  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<GatewayTransferResult | null>(null)

  const transfer = useCallback(async (params: GatewayTransferParams): Promise<GatewayTransferResult> => {
    if (!address || !bundlerClient || !account || !publicClient || !walletClient) {
      throw new Error('Wallets not connected')
    }

    const sourceChain = params.sourceChain.testnet
    const destChain = arcTestnetConfig.testnet
    const transferAmount = parseUnits(params.amount, USDC_DECIMALS)
    // Max fee is ~2% of transfer or minimum 2.01 USDC, whichever is higher
    // Gateway requires at least 2 USDC as max fee
    const percentageFee = transferAmount / BigInt(50) // 2%
    const minFee = BigInt('2010000') // 2.01 USDC minimum (Gateway requirement)
    const maxFee = percentageFee > minFee ? percentageFee : minFee
    const requiredAmount = transferAmount + maxFee

    setIsLoading(true)
    setStatus('Preparing transfer...')
    setError(null)
    setResult(null)

    try {
      // Step 0: Check USDC balance before proceeding
      setStatus('Checking balance...')

      const balance = await publicClient.readContract({
        address: sourceChain.USDCAddress,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })

      if (balance < requiredAmount) {
        const balanceFormatted = (Number(balance) / 1e6).toFixed(2)
        const requiredFormatted = (Number(requiredAmount) / 1e6).toFixed(2)
        const feeFormatted = (Number(maxFee) / 1e6).toFixed(2)
        throw new Error(`Insufficient USDC balance. You have ${balanceFormatted} USDC but need ${requiredFormatted} USDC (${params.amount} + ${feeFormatted} fee)`)
      }

      // Step 1: Check allowance and approve if needed
      setStatus('Checking allowance...')

      const allowance = await publicClient.readContract({
        address: sourceChain.USDCAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, sourceChain.GatewayWallet],
      })

      if (allowance < requiredAmount) {
        setStatus('Approving USDC (sign in wallet)...')

        const approveHash = await walletClient.writeContract({
          address: sourceChain.USDCAddress,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [sourceChain.GatewayWallet, requiredAmount],
        })

        await publicClient.waitForTransactionReceipt({ hash: approveHash })
      }

      // Step 2: Deposit USDC into GatewayWallet (transfer amount + max fee)
      setStatus('Depositing to Gateway (sign in wallet)...')

      const depositHash = await walletClient.writeContract({
        address: sourceChain.GatewayWallet,
        abi: GATEWAY_WALLET_ABI,
        functionName: 'deposit',
        args: [sourceChain.USDCAddress, requiredAmount],
      })

      await publicClient.waitForTransactionReceipt({ hash: depositHash })

      // Wait for Gateway indexer to pick up the deposit
      // Use chain-specific wait times based on block confirmation requirements
      const waitConfig = CHAIN_WAIT_TIMES[params.sourceChain.domain] || DEFAULT_WAIT
      setStatus(`Waiting for ${waitConfig.name} confirmation...`)
      await new Promise(resolve => setTimeout(resolve, waitConfig.waitMs))

      // Step 3: Build the burn intent
      setStatus('Sign transfer message...')

      const salt = randomSalt()
      const burnIntent = {
        maxBlockHeight: maxUint256.toString(),
        maxFee: maxFee.toString(),
        spec: {
          version: 1,
          sourceDomain: params.sourceChain.domain,
          destinationDomain: arcTestnetConfig.domain,
          sourceContract: addressToBytes32(sourceChain.GatewayWallet),
          destinationContract: addressToBytes32(destChain.GatewayMinter),
          sourceToken: addressToBytes32(sourceChain.USDCAddress),
          destinationToken: addressToBytes32(destChain.USDCAddress),
          sourceDepositor: addressToBytes32(address),
          destinationRecipient: addressToBytes32(params.recipientAddress),
          sourceSigner: addressToBytes32(address),
          destinationCaller: addressToBytes32(zeroAddress), // Anyone can mint
          value: transferAmount.toString(),
          salt,
          hookData: '0x' as `0x${string}`,
        },
      }

      // Step 4: Sign the burn intent with MetaMask
      const signature = await signTypedDataAsync({
        types: EIP712_TYPES,
        domain: EIP712_DOMAIN,
        primaryType: 'BurnIntent' as const,
        message: burnIntent,
      } as Parameters<typeof signTypedDataAsync>[0])

      // Step 5: Submit to Gateway API
      setStatus('Getting attestation...')

      const requestBody = [{ burnIntent, signature }]

      const response = await fetch(`${GATEWAY_API_URL}/transfer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Gateway API failed: ${response.status} - ${errorText}`)
      }

      const { attestation, signature: apiSignature } = await response.json()

      // Step 6: Call gatewayMint on Arc using Modular Wallet
      setStatus('Minting on Arc...')

      const mintCallData = encodeFunctionData({
        abi: GATEWAY_MINTER_ABI,
        functionName: 'gatewayMint',
        args: [attestation, apiSignature],
      })

      const userOpHash = await bundlerClient.sendUserOperation({
        account,
        calls: [
          {
            to: destChain.GatewayMinter,
            data: mintCallData,
          },
        ],
        paymaster: true,
        ...(chainConfig.minGasFees && {
          maxPriorityFeePerGas: chainConfig.minGasFees.maxPriorityFeePerGas,
          maxFeePerGas: chainConfig.minGasFees.maxFeePerGas,
        }),
      })

      setStatus('Confirming...')
      const receipt = await bundlerClient.waitForUserOperationReceipt({ hash: userOpHash })

      const transferResult: GatewayTransferResult = {
        amount: params.amount,
        sourceAddress: address,
        destinationAddress: params.recipientAddress,
        mintTxHash: receipt.receipt.transactionHash,
      }

      setResult(transferResult)
      setStatus('Transfer complete!')
      return transferResult
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Transfer failed'
      setError(message)
      setStatus('')
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [address, signTypedDataAsync, publicClient, walletClient, bundlerClient, account, chainConfig])

  const reset = useCallback(() => {
    setIsLoading(false)
    setStatus('')
    setError(null)
    setResult(null)
  }, [])

  return {
    transfer,
    isLoading,
    status,
    error,
    result,
    reset,
  }
}
