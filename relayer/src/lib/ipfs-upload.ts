import { isStorachaEnabled, uploadJSON } from './storacha.js'
import { setPlanIpfsCid, type PlanMetadata } from '../db/metadata.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('ipfs-upload')

/**
 * Upload plan metadata to IPFS via Storacha and store the CID in the database.
 * Resolves relative logo paths to absolute URLs before upload.
 * Returns the CID string on success, throws on failure.
 * Throws if Storacha is not configured (caller should check isStorachaEnabled() first).
 */
export async function uploadPlanToIPFS(
  databaseUrl: string,
  planId: string,
  merchantAddress: string,
  metadata: PlanMetadata,
  logoResolver?: (filename: string) => string | null,
): Promise<string> {
  if (!isStorachaEnabled()) {
    throw new Error('Storacha is not configured')
  }

  // Deep-copy metadata so we don't mutate the caller's object
  const metadataCopy: PlanMetadata = JSON.parse(JSON.stringify(metadata))

  // Resolve relative logo to absolute URL
  if (metadataCopy.merchant?.logo && logoResolver) {
    const logo = metadataCopy.merchant.logo
    if (!logo.startsWith('http://') && !logo.startsWith('https://') && !logo.startsWith('ipfs://')) {
      const resolved = logoResolver(logo)
      if (resolved) {
        metadataCopy.merchant.logo = resolved
      }
    }
  }

  const cid = await uploadJSON(metadataCopy)
  await setPlanIpfsCid(databaseUrl, planId, merchantAddress, cid)
  logger.info({ planId, merchantAddress, cid }, 'Plan metadata uploaded to IPFS')
  return cid
}
