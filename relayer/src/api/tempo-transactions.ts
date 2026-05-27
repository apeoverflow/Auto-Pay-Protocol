/**
 * Tempo transaction endpoints — server-side wallet operations via Privy Node SDK.
 *
 * Uses the createPrivyAccount pattern from Privy's MPP demo: creates a viem Account
 * that delegates signing to Privy's API, then uses standard viem writeContract.
 *
 * Endpoints:
 *   POST /api/tempo/create-wallet — create a server-side wallet
 *   POST /api/tempo/approve — approve USDC.e to PolicyManager
 *   POST /api/tempo/create-policy — create a subscription policy
 *   POST /api/tempo/revoke-policy — revoke a policy
 *   POST /api/tempo/fund — fund a new wallet with $0.10 USDC.e
 */
import type { IncomingMessage, ServerResponse } from 'http'
import { maxUint256, parseUnits, decodeEventLog } from 'viem'
import { verifyPrivyToken, getOrCreateServerWallet, createTempoClients, walletRpc } from './privy-client.js'
import { SlidingWindowRateLimiter } from './rate-limit.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('api:tempo-tx')

// Tempo constants
const USDC_E = '0x20c000000000000000000000b9537d11c60e8b50' as `0x${string}`
const POLICY_MANAGER = '0x5EDAF928C94A249C5Ce1eaBaD0fE799CD294f345' as `0x${string}`
const FUND_AMOUNT = parseUnits('0.1', 6) // $0.10 USDC.e

// Rate limiting per userId
const txRateLimiter = new SlidingWindowRateLimiter({ windowMs: 60_000, maxRequests: 10 })

// DB import for funding deduplication
import { getDb } from '../db/index.js'

// ABIs
const erc20Abi = [
  { name: 'approve', type: 'function' as const, inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' as const },
  { name: 'transfer', type: 'function' as const, inputs: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }], outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable' as const },
] as const

const policyManagerAbi = [
  { name: 'createPolicy', type: 'function' as const, inputs: [{ name: 'merchant', type: 'address' }, { name: 'chargeAmount', type: 'uint128' }, { name: 'interval', type: 'uint32' }, { name: 'spendingCap', type: 'uint128' }, { name: 'metadataUrl', type: 'string' }], outputs: [{ name: 'policyId', type: 'bytes32' }], stateMutability: 'nonpayable' as const },
  { name: 'revokePolicy', type: 'function' as const, inputs: [{ name: 'policyId', type: 'bytes32' }], outputs: [], stateMutability: 'nonpayable' as const },
] as const

const policyCreatedEvent = {
  type: 'event' as const,
  name: 'PolicyCreated',
  inputs: [
    { name: 'policyId', type: 'bytes32', indexed: true },
    { name: 'payer', type: 'address', indexed: true },
    { name: 'merchant', type: 'address', indexed: true },
    { name: 'chargeAmount', type: 'uint128', indexed: false },
    { name: 'interval', type: 'uint32', indexed: false },
    { name: 'spendingCap', type: 'uint128', indexed: false },
    { name: 'metadataUrl', type: 'string', indexed: false },
  ],
}

// --- Helpers ---

async function parseBody(req: IncomingMessage): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.on('data', (chunk: Buffer) => { body += chunk.toString() })
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}) }
      catch { reject(new Error('Invalid JSON')) }
    })
    req.on('error', reject)
  })
}

interface AuthenticatedRequest {
  userId: string
  walletId: string
  walletAddress: `0x${string}`
  body: any
}

async function authenticateAndParse(req: IncomingMessage, res: ServerResponse): Promise<AuthenticatedRequest | null> {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'Missing Authorization: Bearer <token>' })
    return null
  }

  let userId: string
  try {
    userId = await verifyPrivyToken(authHeader.slice(7))
  } catch (err: any) {
    logger.warn({ err: err.message }, 'Auth failed')
    sendJson(res, 401, { error: 'Invalid or expired token' })
    return null
  }

  let body: any
  try { body = await parseBody(req) } catch {
    sendJson(res, 400, { error: 'Invalid JSON' })
    return null
  }

  const { walletId, walletAddress } = body
  if (!walletId || !walletAddress) {
    sendJson(res, 400, { error: 'walletId and walletAddress are required' })
    return null
  }

  const rateResult = txRateLimiter.check(userId)
  if (!rateResult.allowed) {
    sendJson(res, 429, { error: 'Rate limited' })
    return null
  }

  return { userId, walletId, walletAddress: walletAddress as `0x${string}`, body }
}

function sendJson(res: ServerResponse, status: number, data: any) {
  res.writeHead(status, { 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

// --- Handlers ---

export async function handleTempoCreateWallet(req: IncomingMessage, res: ServerResponse) {
  const authHeader = req.headers['authorization']
  if (!authHeader?.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'Missing Authorization: Bearer <token>' })
    return
  }
  let userId: string
  try {
    userId = await verifyPrivyToken(authHeader.slice(7))
    logger.info({ userId }, 'Tempo create-wallet: authenticated user')
  } catch (err: any) {
    logger.error({ err: err.message }, 'Tempo create-wallet: auth failed')
    sendJson(res, 401, { error: 'Invalid or expired token' })
    return
  }

  try {
    let body: any = {}
    try { body = await parseBody(req) } catch {}
    const email = body.email || undefined
    logger.info({ userId, email }, 'Tempo create-wallet: looking up/creating wallet...')
    const wallet = await getOrCreateServerWallet(userId, email)
    logger.info({ userId, walletId: wallet.id, address: wallet.address }, 'Tempo wallet ready')
    sendJson(res, 200, { walletId: wallet.id, address: wallet.address })
  } catch (err: any) {
    logger.error({ err: err.message }, 'Failed to create Tempo wallet')
    sendJson(res, 500, { error: err.message || 'Failed to create wallet' })
  }
}

export async function handleTempoApprove(req: IncomingMessage, res: ServerResponse) {
  const auth = await authenticateAndParse(req, res)
  if (!auth) return

  try {
    const { walletClient, publicClient } = await createTempoClients(auth.walletId, auth.walletAddress)

    logger.info({ walletId: auth.walletId }, 'Tempo approve USDC.e (feeToken)')
    const hash = await (walletClient as any).writeContract({
      address: USDC_E,
      abi: erc20Abi,
      functionName: 'approve',
      args: [POLICY_MANAGER, maxUint256],
      feeToken: USDC_E,
    })

    await publicClient.waitForTransactionReceipt({ hash })
    sendJson(res, 200, { hash })
  } catch (err: any) {
    logger.error({ err: err.message, walletId: auth.walletId }, 'Tempo approve failed')
    sendJson(res, 500, { error: err.message || 'Approve failed' })
  }
}

export async function handleTempoCreatePolicy(req: IncomingMessage, res: ServerResponse) {
  const auth = await authenticateAndParse(req, res)
  if (!auth) return

  const { merchant, chargeAmount, interval, spendingCap, metadataUrl } = auth.body

  if (!merchant || !merchant.startsWith('0x') || merchant.length !== 42) {
    sendJson(res, 400, { error: 'Invalid merchant address' }); return
  }
  if (!chargeAmount || BigInt(chargeAmount) <= 0n) {
    sendJson(res, 400, { error: 'Invalid chargeAmount' }); return
  }
  if (!interval || Number(interval) < 60) {
    sendJson(res, 400, { error: 'Invalid interval (min 60 seconds)' }); return
  }
  if (!spendingCap || BigInt(spendingCap) <= 0n) {
    sendJson(res, 400, { error: 'Invalid spendingCap' }); return
  }

  try {
    const { walletClient, publicClient } = await createTempoClients(auth.walletId, auth.walletAddress)

    logger.info({ walletId: auth.walletId, merchant }, 'Tempo createPolicy (feeToken)')
    const hash = await (walletClient as any).writeContract({
      address: POLICY_MANAGER,
      abi: policyManagerAbi,
      functionName: 'createPolicy',
      args: [merchant as `0x${string}`, BigInt(chargeAmount), Number(interval), BigInt(spendingCap), metadataUrl || ''],
      feeToken: USDC_E,
    })

    const receipt = await publicClient.waitForTransactionReceipt({ hash })

    let policyId: string | undefined
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: [policyCreatedEvent],
          data: log.data,
          topics: log.topics,
        })
        if (decoded.eventName === 'PolicyCreated') {
          policyId = (decoded.args as any).policyId
        }
      } catch { /* not this event */ }
    }

    sendJson(res, 200, { hash, policyId })
  } catch (err: any) {
    logger.error({ err: err.message, walletId: auth.walletId }, 'Tempo createPolicy failed')
    sendJson(res, 500, { error: err.message || 'Create policy failed' })
  }
}

export async function handleTempoRevokePolicy(req: IncomingMessage, res: ServerResponse) {
  const auth = await authenticateAndParse(req, res)
  if (!auth) return

  const { policyId } = auth.body
  if (!policyId || !policyId.startsWith('0x')) {
    sendJson(res, 400, { error: 'Invalid policyId' }); return
  }

  try {
    const { walletClient, publicClient } = await createTempoClients(auth.walletId, auth.walletAddress)

    logger.info({ walletId: auth.walletId, policyId }, 'Tempo revokePolicy (feeToken)')
    const hash = await (walletClient as any).writeContract({
      address: POLICY_MANAGER,
      abi: policyManagerAbi,
      functionName: 'revokePolicy',
      args: [policyId as `0x${string}`],
      feeToken: USDC_E,
    })
    await publicClient.waitForTransactionReceipt({ hash })
    sendJson(res, 200, { hash })
  } catch (err: any) {
    logger.error({ err: err.message, walletId: auth.walletId }, 'Tempo revokePolicy failed')
    sendJson(res, 500, { error: err.message || 'Revoke policy failed' })
  }
}

export async function handleTempoFund(req: IncomingMessage, res: ServerResponse) {
  const auth = await authenticateAndParse(req, res)
  if (!auth) return

  const targetAddress = (auth.body.address || auth.walletAddress).toLowerCase()

  // Check DB for funding status
  const db = getDb(process.env.DATABASE_URL!)
  const existing = await db`
    SELECT funded_at FROM tempo_wallets WHERE address = ${targetAddress}
  `
  if (existing.length > 0 && existing[0].funded_at) {
    sendJson(res, 200, { funded: true, message: 'Already funded' })
    return
  }

  try {
    const treasuryWalletId = process.env.PRIVY_TREASURY_WALLET_ID
    const treasuryAddress = process.env.PRIVY_TREASURY_ADDRESS
    if (!treasuryWalletId || !treasuryAddress) {
      sendJson(res, 503, { error: 'Treasury wallet not configured' })
      return
    }

    logger.info({ to: targetAddress, amount: '0.10 USDC.e' }, 'Funding Tempo wallet')

    const { walletClient, publicClient } = await createTempoClients(treasuryWalletId, treasuryAddress as `0x${string}`)
    const hash = await (walletClient as any).writeContract({
      address: USDC_E,
      abi: erc20Abi,
      functionName: 'transfer',
      args: [targetAddress as `0x${string}`, FUND_AMOUNT],
      feeToken: USDC_E,
    })
    await publicClient.waitForTransactionReceipt({ hash })

    // Mark as funded in DB
    await db`
      UPDATE tempo_wallets SET funded_at = NOW() WHERE address = ${targetAddress}
    `
    logger.info({ to: targetAddress, hash }, 'Tempo wallet funded')

    sendJson(res, 200, { funded: true, hash, amount: '0.10' })
  } catch (err: any) {
    logger.error({ err: err.message, address: targetAddress }, 'Failed to fund Tempo wallet')
    sendJson(res, 500, { error: 'Failed to fund wallet', details: err.message })
  }
}

export async function handleTempoSignMessage(req: IncomingMessage, res: ServerResponse) {
  const auth = await authenticateAndParse(req, res)
  if (!auth) return

  const { message } = auth.body
  if (!message || typeof message !== 'string') {
    sendJson(res, 400, { error: 'message is required' })
    return
  }

  try {
    const result = await walletRpc(auth.walletId, {
      method: 'personal_sign',
      params: { message, encoding: 'utf-8' },
    })

    sendJson(res, 200, { signature: (result as any).data?.signature || (result as any).signature })
  } catch (err: any) {
    logger.error({ err: err.message, walletId: auth.walletId }, 'Tempo sign message failed')
    sendJson(res, 500, { error: err.message || 'Sign failed' })
  }
}
