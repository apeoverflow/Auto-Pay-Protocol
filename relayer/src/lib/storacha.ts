import { createLogger } from '../utils/logger.js'

const logger = createLogger('storacha')

export const IPFS_GATEWAY = process.env.IPFS_GATEWAY || 'https://w3s.link'

export function ipfsGatewayUrl(cid: string): string {
  return `${IPFS_GATEWAY}/ipfs/${cid}`
}

let clientPromise: Promise<unknown> | null = null

/**
 * Check if Storacha env vars are configured.
 */
export function isStorachaEnabled(): boolean {
  return !!(process.env.STORACHA_PRINCIPAL_KEY && process.env.STORACHA_DELEGATION_PROOF)
}

/**
 * Lazy singleton — creates and authenticates a Storacha client on first call.
 * Uses dynamic imports so the @storacha/client package is only loaded when needed.
 */
export async function getStorachaClient(): Promise<unknown> {
  if (clientPromise) return clientPromise

  clientPromise = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ClientMod = await import('@storacha/client') as any
    const { Signer } = await import('@storacha/client/principal/ed25519')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Proof = await import('@storacha/client/proof') as any
    const { StoreMemory } = await import('@storacha/client/stores/memory')

    const Create = ClientMod.create ?? ClientMod.default?.create ?? ClientMod

    const principal = Signer.parse(process.env.STORACHA_PRINCIPAL_KEY!)
    const store = new StoreMemory()
    const client = await Create({ principal, store })

    const proof = await Proof.parse(process.env.STORACHA_DELEGATION_PROOF!)
    const space = await client.addSpace(proof)
    await client.setCurrentSpace(space.did())

    logger.info({ space: space.did() }, 'Storacha client initialized')
    return client
  })()

  // Reset on failure so next call retries
  clientPromise.catch(() => {
    clientPromise = null
  })

  return clientPromise
}

/**
 * Serialize data to JSON and upload to IPFS via Storacha.
 * Returns the CID string (e.g. "bafybeig...").
 */
export async function uploadJSON(data: unknown): Promise<string> {
  const client = (await getStorachaClient()) as {
    uploadFile: (file: Blob) => Promise<{ toString(): string }>
  }

  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const cid = await client.uploadFile(blob)

  logger.info({ cid: cid.toString(), bytes: json.length }, 'Uploaded JSON to IPFS')
  return cid.toString()
}
