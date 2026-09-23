/**
 * IPFS storage facade.
 *
 * Consumers import upload / gateway / feature-flag helpers from HERE
 * (not directly from pinata.ts) so swapping providers in the future is
 * a single-file change. Also lets us log a stable provider name in
 * metrics / logs without every caller knowing which backend is live.
 *
 * Current backend: Pinata (see pinata.ts).
 */
export { isPinataEnabled as isIpfsEnabled, uploadJSON, ipfsGatewayUrl } from './pinata.js'

/** Human-readable label used in log messages. Update when swapping backends. */
export const IPFS_PROVIDER = 'pinata' as const
