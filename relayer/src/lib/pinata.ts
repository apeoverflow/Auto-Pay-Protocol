import { createLogger } from '../utils/logger.js'

const logger = createLogger('pinata')

const PINATA_API_BASE = 'https://api.pinata.cloud'
const DEFAULT_GATEWAY = 'https://gateway.pinata.cloud'

/**
 * Whether Pinata credentials are present. Consumers should check this
 * before attempting upload — a missing JWT is a soft-fail (upload skipped,
 * caller decides what to do), not an error.
 */
export function isPinataEnabled(): boolean {
  return !!process.env.PINATA_JWT
}

/**
 * Public IPFS gateway URL for a CID. Defaults to Pinata's own gateway
 * (fast, no rate limit for our tier) but honours a custom IPFS_GATEWAY
 * env var so operators can point at any public gateway or their own.
 *
 * Both `https://gateway.example` (no `/ipfs`) and `https://gateway.example/ipfs`
 * are accepted; the trailing `/ipfs` is added if missing.
 */
export function ipfsGatewayUrl(cid: string): string {
  const raw = (process.env.IPFS_GATEWAY || DEFAULT_GATEWAY).replace(/\/+$/, '')
  const base = raw.endsWith('/ipfs') ? raw : `${raw}/ipfs`
  return `${base}/${cid}`
}

/**
 * Serialise a JS value to JSON and pin it via Pinata's pinJSONToIPFS API.
 * Returns the CID. Throws on any non-2xx response — callers should catch
 * and downgrade to "IPFS upload failed, continue anyway" per the
 * non-blocking archival model.
 */
export async function uploadJSON(data: unknown, opts: { name?: string } = {}): Promise<string> {
  const jwt = process.env.PINATA_JWT
  if (!jwt) throw new Error('PINATA_JWT is not configured')

  const body = {
    // Pinata expects the payload nested under pinataContent. pinataMetadata
    // is optional but useful for humans browsing the Pinata dashboard.
    pinataContent: data,
    ...(opts.name && { pinataMetadata: { name: opts.name } }),
  }

  const res = await fetch(`${PINATA_API_BASE}/pinning/pinJSONToIPFS`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`Pinata upload failed: HTTP ${res.status} ${text}`)
  }

  const json = await res.json() as { IpfsHash?: string; PinSize?: number }
  if (!json.IpfsHash) {
    throw new Error(`Pinata response missing IpfsHash: ${JSON.stringify(json)}`)
  }

  logger.info({ cid: json.IpfsHash, bytes: json.PinSize, name: opts.name }, 'Uploaded JSON to IPFS via Pinata')
  return json.IpfsHash
}
