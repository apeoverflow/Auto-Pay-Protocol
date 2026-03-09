import {
  createPublicClient,
  createWalletClient,
  http,
  parseUnits,
  decodeEventLog,
  maxUint256,
  defineChain,
  type PublicClient,
  type Transport,
  type Chain,
  type Account,
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { POLICY_MANAGER_ABI, ERC20_ABI } from './abi'
import { bridgeUsdc, swapNativeToUsdc } from './bridge'
import { chains, type AgentChainConfig } from './chains'
import { intervals, USDC_DECIMALS } from './constants'
import {
  InsufficientBalanceError,
  InsufficientGasError,
  TransactionFailedError,
  PolicyNotFoundError,
} from './errors'
import type {
  AgentConfig,
  BridgeParams,
  BridgeResult,
  SwapParams,
  SwapResult,
  SubscribeParams,
  Subscription,
  Policy,
  ChainKey,
  IntervalPreset,
} from './types'

const INTERVAL_MAP: Record<IntervalPreset, number> = {
  hourly: intervals.hourly,
  daily: intervals.daily,
  weekly: intervals.weekly,
  biweekly: intervals.biweekly,
  monthly: intervals.monthly,
  quarterly: intervals.quarterly,
  yearly: intervals.yearly,
}

function resolveInterval(interval: number | IntervalPreset): number {
  if (typeof interval === 'number') return interval
  const seconds = INTERVAL_MAP[interval]
  if (!seconds) throw new Error(`Unknown interval preset: ${interval}`)
  return seconds
}

export class AutoPayAgent {
  readonly address: `0x${string}`
  readonly chain: AgentChainConfig

  private readonly account: ReturnType<typeof privateKeyToAccount>
  private readonly publicClient: PublicClient<Transport, Chain>
  private readonly walletClient: ReturnType<typeof createWalletClient<Transport, Chain, Account>>

  constructor(config: AgentConfig) {
    const chainKey: ChainKey = config.chain ?? 'base'
    const chainConfig = chains[chainKey]
    if (!chainConfig) {
      throw new Error(`Unknown chain: ${chainKey}`)
    }

    this.chain = {
      ...chainConfig,
      rpcUrl: config.rpcUrl ?? chainConfig.rpcUrl,
      policyManager: config.policyManager ?? chainConfig.policyManager,
      usdc: config.usdc ?? chainConfig.usdc,
    }

    const account = privateKeyToAccount(config.privateKey)
    this.account = account
    this.address = account.address

    const viemChain = defineChain({
      id: this.chain.chainId,
      name: this.chain.name,
      nativeCurrency: this.chain.nativeCurrency,
      rpcUrls: { default: { http: [this.chain.rpcUrl] } },
    })

    const transport = http(this.chain.rpcUrl)

    this.publicClient = createPublicClient({
      chain: viemChain,
      transport,
      pollingInterval: 2_000, // 2s polling for tx receipts
    })
    this.walletClient = createWalletClient({ account, chain: viemChain, transport })
  }

  /**
   * Create a signed Bearer token for a policyId.
   * Format: `{policyId}.{timestamp}.{signature}`
   *
   * The signature proves the agent owns the wallet that created the policy.
   * Services verify by recovering the signer and matching it to the on-chain payer.
   *
   * @param policyId - The on-chain policy ID
   * @param ttlSeconds - Token validity in seconds. Default: 3600 (1 hour)
   */
  async createBearerToken(policyId: `0x${string}`, ttlSeconds = 3600): Promise<string> {
    const timestamp = Math.floor(Date.now() / 1000) + ttlSeconds
    const message = `${policyId}:${timestamp}`
    const signature = await this.account.signMessage({ message })
    return `${policyId}.${timestamp}.${signature}`
  }

  /** Get USDC balance (raw 6-decimal bigint) */
  async getBalance(): Promise<bigint> {
    return this.publicClient.readContract({
      address: this.chain.usdc,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [this.address],
    })
  }

  /** Get native token balance (raw 18-decimal bigint) */
  async getGasBalance(): Promise<bigint> {
    return this.publicClient.getBalance({ address: this.address })
  }

  /** Bridge USDC from another chain to this agent's configured destination chain */
  async bridgeUsdc(params: BridgeParams): Promise<BridgeResult> {
    return bridgeUsdc({
      ...params,
      toChainId: this.chain.chainId,
      toUsdcAddress: this.chain.usdc,
      fromAddress: this.address,
      account: this.account,
    })
  }

  /** Swap native tokens (FLOW, ETH, etc.) to USDC on the same chain via LiFi */
  async swapNativeToUsdc(params: SwapParams): Promise<SwapResult> {
    return swapNativeToUsdc({
      ...params,
      chainId: this.chain.chainId,
      usdcAddress: this.chain.usdc,
      rpcUrl: this.chain.rpcUrl,
      fromAddress: this.address,
      account: this.account,
    })
  }

  /** Approve USDC spending to PolicyManager. Default: MaxUint256 */
  async approveUsdc(amount?: bigint): Promise<`0x${string}`> {
    const approvalAmount = amount ?? maxUint256

    const hash = await this.walletClient.writeContract({
      address: this.chain.usdc,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [this.chain.policyManager, approvalAmount],
    })

    await this.publicClient.waitForTransactionReceipt({ hash, timeout: 300_000 })
    return hash
  }

  /**
   * Subscribe to a merchant service.
   * Auto-approves USDC if current allowance is insufficient.
   * First charge executes immediately within the createPolicy transaction.
   */
  async subscribe(params: SubscribeParams): Promise<Subscription> {
    const intervalSeconds = resolveInterval(params.interval)
    const chargeAmount = parseUnits(String(params.amount), USDC_DECIMALS)
    const spendingCapAmount = params.spendingCap != null
      ? parseUnits(String(params.spendingCap), USDC_DECIMALS)
      : chargeAmount * 30n

    // Check USDC balance
    const balance = await this.getBalance()
    if (balance < chargeAmount) {
      throw new InsufficientBalanceError(chargeAmount, balance)
    }

    // Check gas balance
    const gasBalance = await this.getGasBalance()
    if (gasBalance === 0n) {
      throw new InsufficientGasError()
    }

    // Check allowance, auto-approve if insufficient
    const allowance = await this.publicClient.readContract({
      address: this.chain.usdc,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [this.address, this.chain.policyManager],
    })

    // Need allowance >= spendingCap (or at least chargeAmount if cap is 0/unlimited)
    const minAllowance = spendingCapAmount > 0n ? spendingCapAmount : chargeAmount
    if (allowance < minAllowance) {
      // Approve the full cap, or MaxUint256 for unlimited subscriptions
      await this.approveUsdc(spendingCapAmount > 0n ? spendingCapAmount : undefined)
    }

    // Create policy (first charge executes immediately)
    const hash = await this.walletClient.writeContract({
      address: this.chain.policyManager,
      abi: POLICY_MANAGER_ABI,
      functionName: 'createPolicy',
      args: [
        params.merchant,
        chargeAmount,
        intervalSeconds,
        spendingCapAmount,
        params.metadataUrl ?? '',
      ],
    })

    const receipt = await this.publicClient.waitForTransactionReceipt({ hash, timeout: 300_000 })

    // Parse PolicyCreated event to get policyId
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: POLICY_MANAGER_ABI,
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'PolicyCreated') {
          return {
            policyId: (decoded.args as { policyId: `0x${string}` }).policyId,
            txHash: hash,
          }
        }
      } catch {
        // Not our event, skip
      }
    }

    throw new TransactionFailedError('PolicyCreated event not found in receipt', hash)
  }

  /** Cancel a subscription by revoking the on-chain policy */
  async unsubscribe(policyId: `0x${string}`): Promise<`0x${string}`> {
    const hash = await this.walletClient.writeContract({
      address: this.chain.policyManager,
      abi: POLICY_MANAGER_ABI,
      functionName: 'revokePolicy',
      args: [policyId],
    })

    await this.publicClient.waitForTransactionReceipt({ hash, timeout: 300_000 })
    return hash
  }

  /** Read full policy details from on-chain state */
  async getPolicy(policyId: `0x${string}`): Promise<Policy> {
    const result = await this.publicClient.readContract({
      address: this.chain.policyManager,
      abi: POLICY_MANAGER_ABI,
      functionName: 'policies',
      args: [policyId],
    })

    const [
      payer, merchant, chargeAmount, spendingCap, totalSpent,
      interval, lastCharged, chargeCount, consecutiveFailures,
      endTime, active, metadataUrl,
    ] = result

    // Check if this is a zero/nonexistent policy
    if (payer === '0x0000000000000000000000000000000000000000') {
      throw new PolicyNotFoundError(policyId)
    }

    return {
      policyId,
      payer,
      merchant,
      chargeAmount,
      spendingCap,
      totalSpent,
      interval,
      lastCharged,
      chargeCount,
      consecutiveFailures,
      endTime,
      active,
      metadataUrl,
    }
  }

  /** Check if a policy is currently active */
  async isActive(policyId: `0x${string}`): Promise<boolean> {
    const policy = await this.getPolicy(policyId)
    return policy.active
  }

  /** Check if a policy can be charged right now */
  async canCharge(policyId: `0x${string}`): Promise<{ ok: boolean; reason: string }> {
    const [ok, reason] = await this.publicClient.readContract({
      address: this.chain.policyManager,
      abi: POLICY_MANAGER_ABI,
      functionName: 'canCharge',
      args: [policyId],
    })
    return { ok, reason }
  }
}
