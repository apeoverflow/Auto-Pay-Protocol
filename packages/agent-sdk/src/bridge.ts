import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  maxUint256,
  defineChain,
  type Account,
} from 'viem'
import { ERC20_ABI } from './abi'
import { USDC_DECIMALS } from './constants'
import {
  BridgeQuoteError,
  BridgeExecutionError,
  BridgeTimeoutError,
} from './errors'
import type { BridgeParams, BridgeResult, BridgeStatus, SwapResult } from './types'

const LIFI_API = 'https://li.quest/v1'

/** USDC contract addresses on common source chains */
export const SOURCE_USDC: Record<number, `0x${string}`> = {
  1: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',      // Ethereum
  10: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',     // Optimism
  137: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',    // Polygon
  42161: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',  // Arbitrum
  43114: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',  // Avalanche
  56: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',      // BSC
  8453: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',   // Base
  747: '0xF1815bd50389c46847f0Bda824eC8da914045D14',     // Flow EVM
  84532: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',   // Base Sepolia
}

export interface InternalBridgeParams extends BridgeParams {
  toChainId: number
  toUsdcAddress: `0x${string}`
  fromAddress: `0x${string}`
  account: Account
}

/**
 * Bridge USDC from one chain to another using the LiFi REST API.
 *
 * Flow: get quote → check/approve token → submit bridge tx → poll for completion
 */
export async function bridgeUsdc(params: InternalBridgeParams): Promise<BridgeResult> {
  const {
    fromChainId,
    toChainId,
    amount,
    sourceRpcUrl,
    toUsdcAddress,
    fromAddress,
    account,
    slippage = 0.5,
    pollIntervalMs = 10_000,
    timeoutMs = 1_800_000,
    onStatus,
  } = params

  const fromToken = SOURCE_USDC[fromChainId]
  if (!fromToken) {
    throw new BridgeQuoteError(
      `No USDC address known for source chain ${fromChainId}. ` +
      `Supported chains: ${Object.keys(SOURCE_USDC).join(', ')}`,
    )
  }

  const fromAmount = parseUnits(String(amount), USDC_DECIMALS).toString()
  const startTime = Date.now()

  // 1. Get quote from LiFi
  onStatus?.({ step: 'quoting' })

  const quoteParams = new URLSearchParams({
    fromChain: String(fromChainId),
    toChain: String(toChainId),
    fromToken,
    toToken: toUsdcAddress,
    fromAmount,
    fromAddress,
    slippage: String(slippage / 100), // LiFi expects decimal (0.005 for 0.5%)
  })

  const quoteRes = await fetch(`${LIFI_API}/quote?${quoteParams}`)
  if (!quoteRes.ok) {
    const body = await quoteRes.text()
    throw new BridgeQuoteError(`LiFi quote failed (${quoteRes.status}): ${body}`)
  }

  const quote = await quoteRes.json() as {
    transactionRequest: {
      to: `0x${string}`
      data: `0x${string}`
      value: string
      gasLimit: string
    }
    estimate: {
      approvalAddress: `0x${string}`
      toAmount: string
    }
    action: {
      fromAmount: string
    }
  }

  if (!quote.transactionRequest) {
    throw new BridgeQuoteError('LiFi quote did not include a transactionRequest')
  }

  // 2. Create a wallet client for the source chain
  const sourceChain = defineChain({
    id: fromChainId,
    name: `Chain ${fromChainId}`,
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [sourceRpcUrl] } },
  })

  const transport = http(sourceRpcUrl)
  const publicClient = createPublicClient({ chain: sourceChain, transport })
  const walletClient = createWalletClient({ account, chain: sourceChain, transport })

  // 3. Check token approval and approve if needed
  const approvalAddress = quote.estimate.approvalAddress
  if (approvalAddress) {
    const allowance = await publicClient.readContract({
      address: fromToken,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [fromAddress, approvalAddress],
    })

    if (allowance < BigInt(fromAmount)) {
      onStatus?.({ step: 'approving', token: fromToken })

      const approveHash = await walletClient.writeContract({
        address: fromToken,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [approvalAddress, maxUint256],
      })

      await publicClient.waitForTransactionReceipt({ hash: approveHash })
    }
  }

  // 4. Submit the bridge transaction
  const txRequest = quote.transactionRequest
  const bridgeHash = await walletClient.sendTransaction({
    to: txRequest.to,
    data: txRequest.data,
    value: BigInt(txRequest.value || '0'),
    gas: txRequest.gasLimit ? BigInt(txRequest.gasLimit) : undefined,
  })

  onStatus?.({ step: 'bridging', txHash: bridgeHash })

  // Wait for source tx confirmation
  await publicClient.waitForTransactionReceipt({ hash: bridgeHash })

  onStatus?.({ step: 'waiting', txHash: bridgeHash })

  // 5. Poll LiFi status until done or timeout
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs)

    const statusParams = new URLSearchParams({
      txHash: bridgeHash,
      fromChain: String(fromChainId),
      toChain: String(toChainId),
    })

    const statusRes = await fetch(`${LIFI_API}/status?${statusParams}`)
    if (!statusRes.ok) {
      console.warn(`[autopay] LiFi status poll failed (${statusRes.status}), retrying...`)
      continue
    }

    const status = await statusRes.json() as {
      status: string
      receiving?: { txHash?: string; amount?: string }
      sending?: { amount?: string }
    }

    if (status.status === 'DONE') {
      const result: BridgeResult = {
        sourceTxHash: bridgeHash,
        destinationTxHash: status.receiving?.txHash,
        fromChainId,
        toChainId,
        fromAmount: formatUnits(BigInt(quote.action.fromAmount), USDC_DECIMALS),
        toAmount: status.receiving?.amount
          ? formatUnits(BigInt(status.receiving.amount), USDC_DECIMALS)
          : formatUnits(BigInt(quote.estimate.toAmount), USDC_DECIMALS),
        durationMs: Date.now() - startTime,
      }
      onStatus?.({ step: 'complete', result })
      return result
    }

    if (status.status === 'FAILED') {
      const msg = 'Bridge transaction failed on destination chain'
      onStatus?.({ step: 'failed', error: msg })
      throw new BridgeExecutionError(msg, bridgeHash)
    }

    // PENDING or NOT_FOUND — keep polling
  }

  // Timeout
  throw new BridgeTimeoutError(bridgeHash)
}

// ── Native → USDC Swap (same-chain) ────────────────────────────

const NATIVE_TOKEN_ADDRESS = '0x0000000000000000000000000000000000000000'
const NATIVE_DECIMALS = 18

interface InternalSwapParams {
  amount: number
  chainId: number
  usdcAddress: `0x${string}`
  rpcUrl: string
  fromAddress: `0x${string}`
  account: Account
  slippage?: number
  pollIntervalMs?: number
  timeoutMs?: number
  onStatus?: (status: BridgeStatus) => void
}

/**
 * Swap native tokens (FLOW, ETH, etc.) to USDC on the same chain via LiFi.
 *
 * Uses the same LiFi quote→execute→poll pattern as bridgeUsdc, but:
 * - fromChain === toChain (same-chain swap, not a bridge)
 * - fromToken is the native token placeholder (0x000...000)
 * - No ERC20 approval step needed
 * - transactionRequest.value carries the native amount
 */
export async function swapNativeToUsdc(params: InternalSwapParams): Promise<SwapResult> {
  const {
    amount,
    chainId,
    usdcAddress,
    rpcUrl,
    fromAddress,
    account,
    slippage = 0.5,
    pollIntervalMs = 10_000,
    timeoutMs = 1_800_000,
    onStatus,
  } = params

  const fromAmount = parseUnits(String(amount), NATIVE_DECIMALS).toString()
  const startTime = Date.now()

  // 1. Get quote from LiFi (same-chain swap)
  onStatus?.({ step: 'quoting' })

  const quoteParams = new URLSearchParams({
    fromChain: String(chainId),
    toChain: String(chainId),
    fromToken: NATIVE_TOKEN_ADDRESS,
    toToken: usdcAddress,
    fromAmount,
    fromAddress,
    slippage: String(slippage / 100),
  })

  const quoteRes = await fetch(`${LIFI_API}/quote?${quoteParams}`)
  if (!quoteRes.ok) {
    const body = await quoteRes.text()
    throw new BridgeQuoteError(`LiFi swap quote failed (${quoteRes.status}): ${body}`)
  }

  const quote = await quoteRes.json() as {
    transactionRequest: {
      to: `0x${string}`
      data: `0x${string}`
      value: string
      gasLimit: string
    }
    estimate: {
      toAmount: string
    }
    action: {
      fromAmount: string
    }
  }

  if (!quote.transactionRequest) {
    throw new BridgeQuoteError('LiFi swap quote did not include a transactionRequest')
  }

  // 2. Create clients for the chain
  const chain = defineChain({
    id: chainId,
    name: `Chain ${chainId}`,
    nativeCurrency: { name: 'Native', symbol: 'NATIVE', decimals: 18 },
    rpcUrls: { default: { http: [rpcUrl] } },
  })

  const transport = http(rpcUrl)
  const publicClient = createPublicClient({ chain, transport })
  const walletClient = createWalletClient({ account, chain, transport })

  // 3. Submit the swap transaction (no approval needed for native tokens)
  const txRequest = quote.transactionRequest
  const swapHash = await walletClient.sendTransaction({
    to: txRequest.to,
    data: txRequest.data,
    value: BigInt(txRequest.value || '0'),
    gas: txRequest.gasLimit ? BigInt(txRequest.gasLimit) : undefined,
  })

  onStatus?.({ step: 'bridging', txHash: swapHash })

  // Wait for tx confirmation
  await publicClient.waitForTransactionReceipt({ hash: swapHash })

  onStatus?.({ step: 'waiting', txHash: swapHash })

  // 4. Poll LiFi status until done or timeout
  const deadline = Date.now() + timeoutMs

  while (Date.now() < deadline) {
    await sleep(pollIntervalMs)

    const statusParams = new URLSearchParams({
      txHash: swapHash,
      fromChain: String(chainId),
      toChain: String(chainId),
    })

    const statusRes = await fetch(`${LIFI_API}/status?${statusParams}`)
    if (!statusRes.ok) {
      console.warn(`[autopay] LiFi swap status poll failed (${statusRes.status}), retrying...`)
      continue
    }

    const status = await statusRes.json() as {
      status: string
      receiving?: { amount?: string }
    }

    if (status.status === 'DONE') {
      const usdcAmount = status.receiving?.amount
        ? formatUnits(BigInt(status.receiving.amount), USDC_DECIMALS)
        : formatUnits(BigInt(quote.estimate.toAmount), USDC_DECIMALS)

      const result: SwapResult = {
        txHash: swapHash,
        nativeAmount: formatUnits(BigInt(quote.action.fromAmount), NATIVE_DECIMALS),
        usdcAmount,
        durationMs: Date.now() - startTime,
      }

      onStatus?.({ step: 'complete', result: {
        sourceTxHash: swapHash,
        fromChainId: chainId,
        toChainId: chainId,
        fromAmount: result.nativeAmount,
        toAmount: usdcAmount,
        durationMs: result.durationMs,
      }})

      return result
    }

    if (status.status === 'FAILED') {
      const msg = 'Swap transaction failed'
      onStatus?.({ step: 'failed', error: msg })
      throw new BridgeExecutionError(msg, swapHash)
    }
  }

  throw new BridgeTimeoutError(swapHash)
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
