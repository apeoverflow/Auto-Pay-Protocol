/**
 * Privy Node SDK client — used for server-side wallet operations on Tempo.
 *
 * All wallet API calls include the authorization signature header when
 * PRIVY_AUTHORIZATION_KEY is configured.
 */
import { PrivyClient, generateAuthorizationSignature } from '@privy-io/node'
import { toAccount, type LocalAccount } from 'viem/accounts'
import { keccak256, createWalletClient, createPublicClient, http } from 'viem'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('api:privy')

let _client: PrivyClient | null = null

const TEMPO_CHAIN_ID = 4217
const TEMPO_RPC = process.env.TEMPO_RPC || 'https://rpc.tempo.xyz'

export function getPrivyClient(): PrivyClient | null {
  if (_client) return _client

  const appId = process.env.PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET

  if (!appId || !appSecret) {
    return null
  }

  _client = new PrivyClient({ appId, appSecret })
  logger.info('Privy client initialized')
  return _client
}

/** Strip wallet-auth: prefix from the authorization key */
function getAuthKey(): string | undefined {
  const raw = process.env.PRIVY_AUTHORIZATION_KEY
  if (!raw) return undefined
  return raw.startsWith('wallet-auth:') ? raw.slice('wallet-auth:'.length) : raw
}

export async function verifyPrivyToken(accessToken: string): Promise<string> {
  const privy = getPrivyClient()
  if (!privy) throw new Error('Privy not configured')

  const result = await privy.utils().auth().verifyAccessToken(accessToken)
  return result.user_id
}

export async function getOrCreateServerWallet(userId: string, email?: string): Promise<{ id: string; address: string }> {
  const privy = getPrivyClient()
  if (!privy) throw new Error('Privy not configured')

  // Check database for existing wallet
  const { getDb } = await import('../db/index.js')
  const db = getDb(process.env.DATABASE_URL!)
  const existing = await db`
    SELECT wallet_id, address, email FROM tempo_wallets WHERE privy_user_id = ${userId}
  `
  if (existing.length > 0) {
    // Backfill email if missing
    if (email && !existing[0].email) {
      await db`UPDATE tempo_wallets SET email = ${email} WHERE privy_user_id = ${userId}`
    }
    logger.info({ userId, walletId: existing[0].wallet_id, address: existing[0].address }, 'Found existing wallet in DB')
    return { id: existing[0].wallet_id, address: existing[0].address }
  }

  // Create new wallet owned by the authorization key quorum
  const quorumId = process.env.PRIVY_AUTH_KEY_QUORUM_ID
  const wallet = await privy.wallets().create({
    chain_type: 'ethereum',
    ...(quorumId ? { owner_id: quorumId } : { owner: { user_id: userId } }),
  } as any)

  // Save to database — if another request won the race, return the winner's wallet
  const inserted = await db`
    INSERT INTO tempo_wallets (privy_user_id, wallet_id, address, email)
    VALUES (${userId}, ${wallet.id}, ${wallet.address}, ${email || null})
    ON CONFLICT (privy_user_id) DO NOTHING
    RETURNING wallet_id, address
  `

  if (inserted.length > 0) {
    logger.info({ userId, walletId: wallet.id, address: wallet.address, quorumId }, 'Created new Privy wallet for user')
    return { id: wallet.id, address: wallet.address }
  }

  // Lost the race — another concurrent request created a wallet first. Use theirs.
  const winner = await db`
    SELECT wallet_id, address FROM tempo_wallets WHERE privy_user_id = ${userId}
  `
  logger.info({ userId, walletId: winner[0].wallet_id, address: winner[0].address }, 'Race resolved — using existing wallet')
  return { id: winner[0].wallet_id, address: winner[0].address }
}

/** Make a Privy wallet RPC call with authorization signature — direct HTTP */
export async function walletRpc(walletId: string, body: any): Promise<any> {
  const appId = process.env.PRIVY_APP_ID
  const appSecret = process.env.PRIVY_APP_SECRET
  if (!appId || !appSecret) throw new Error('Privy not configured')

  const url = `https://api.privy.io/v1/wallets/${walletId}/rpc`

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'privy-app-id': appId,
    'Authorization': `Basic ${Buffer.from(`${appId}:${appSecret}`).toString('base64')}`,
  }

  // Add authorization signature
  const authKey = getAuthKey()
  if (authKey) {
    const sig = generateAuthorizationSignature({
      authorizationPrivateKey: `wallet-auth:${authKey}`,
      input: {
        version: 1,
        url,
        method: 'POST',
        headers: { 'privy-app-id': appId },
        body,
      },
    })
    headers['privy-authorization-signature'] = sig
  }

  logger.info({ url, method: body.method, walletId }, '[walletRpc] Request')

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000) // 30s timeout

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    signal: controller.signal,
  }).finally(() => clearTimeout(timeout))

  const data = await res.json()
  if (!res.ok) {
    logger.error({ status: res.status, error: data }, '[walletRpc] Error')
    throw new Error(JSON.stringify(data))
  }

  // For sponsored transactions, hash is empty — poll transaction_id for the real hash
  const txData = data as any
  if (txData.data?.transaction_id && !txData.data?.hash) {
    logger.info({ transactionId: txData.data.transaction_id }, '[walletRpc] Sponsored tx — polling for hash')
    const txHash = await pollTransactionHash(txData.data.transaction_id, headers)
    txData.data.hash = txHash
    txData.hash = txHash
  }

  logger.info({ method: body.method, hash: txData.data?.hash || txData.hash }, '[walletRpc] Success')
  return data
}

/** Poll Privy's transaction endpoint until we get a hash or it fails */
async function pollTransactionHash(transactionId: string, authHeaders: Record<string, string>): Promise<string> {
  const url = `https://api.privy.io/v1/transactions/${transactionId}`
  const maxAttempts = 30
  const delayMs = 2000

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, delayMs))

    const res = await fetch(url, { method: 'GET', headers: authHeaders })
    if (!res.ok) {
      logger.warn({ status: res.status, attempt: i + 1 }, '[pollTx] Failed to check status')
      continue
    }

    const tx = await res.json() as any
    logger.info({ status: tx.status, hash: tx.transaction_hash, attempt: i + 1 }, '[pollTx] Status')

    if (tx.status === 'confirmed' || tx.status === 'finalized') {
      return tx.transaction_hash
    }
    if (tx.status === 'failed' || tx.status === 'execution_reverted' || tx.status === 'provider_error') {
      throw new Error(`Transaction ${tx.status}: ${tx.transaction_hash || transactionId}`)
    }
  }

  throw new Error(`Transaction polling timed out after ${maxAttempts * delayMs / 1000}s`)
}

export function createPrivyAccount(walletId: string, address: `0x${string}`): LocalAccount {
  async function signHash(hash: `0x${string}`): Promise<`0x${string}`> {
    const result = await walletRpc(walletId, {
      method: 'secp256k1_sign',
      params: { hash },
    })
    return (result as any).data?.signature as `0x${string}`
  }

  return toAccount({
    address,

    async signMessage({ message }) {
      const msg = typeof message === 'string' ? message : Buffer.from(message as any).toString('utf-8')
      const result = await walletRpc(walletId, {
        method: 'personal_sign',
        params: { message: msg, encoding: 'utf-8' },
      })
      return ((result as any).data?.signature || (result as any).signature) as `0x${string}`
    },

    async signTransaction(transaction, options) {
      const serializer = (options as any)?.serializer
      if (serializer) {
        const unsignedSerialized = await serializer(transaction)
        const hash = keccak256(unsignedSerialized)
        const signature = await signHash(hash as `0x${string}`)

        const { SignatureEnvelope } = await import('ox/tempo')
        const envelope = SignatureEnvelope.from(signature)
        return (await serializer(transaction, envelope as any)) as `0x${string}`
      }

      const result = await walletRpc(walletId, {
        method: 'eth_signTransaction',
        params: {
          transaction: {
            to: (transaction as any).to,
            data: (transaction as any).data,
            value: (transaction as any).value ? `0x${(transaction as any).value.toString(16)}` : '0x0',
            chain_id: (transaction as any).chainId || TEMPO_CHAIN_ID,
          },
        },
      })
      return (result as any).data?.signed_transaction as `0x${string}`
    },

    async signTypedData(typedData) {
      const result = await walletRpc(walletId, {
        method: 'eth_signTypedData_v4',
        params: { typed_data: typedData as any },
      })
      return ((result as any).data?.signature || (result as any).signature) as `0x${string}`
    },
  }) as LocalAccount
}

export async function createTempoClients(walletId: string, address: `0x${string}`) {
  const account = createPrivyAccount(walletId, address)

  // Use viem's built-in Tempo chain — includes fee token, serializers, and formatters
  const { tempo } = await import('viem/chains')
  const tempoChain = { ...tempo, rpcUrls: { default: { http: [TEMPO_RPC] } } }

  const walletClient = createWalletClient({
    account,
    chain: tempoChain,
    transport: http(TEMPO_RPC),
  })

  const publicClient = createPublicClient({
    chain: tempoChain,
    transport: http(TEMPO_RPC),
  })

  return { walletClient: walletClient as any, publicClient: publicClient as any }
}
