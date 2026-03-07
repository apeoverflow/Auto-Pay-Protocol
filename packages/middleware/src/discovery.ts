import type { DiscoveryOptions, DiscoveryBody } from './types'

/**
 * Builds the 402 response body that agents parse for subscription discovery.
 */
export function createDiscoveryBody(options: DiscoveryOptions): DiscoveryBody {
  return {
    error: 'Subscription required',
    accepts: ['autopay'],
    autopay: {
      type: 'subscription',
      merchant: options.merchant,
      plans: options.plans.map((p) => ({
        name: p.name,
        amount: p.amount,
        currency: p.currency ?? 'USDC',
        interval: p.interval,
        ...(p.description && { description: p.description }),
        ...(p.metadataUrl && { metadataUrl: p.metadataUrl }),
      })),
      networks: options.networks,
      ...(options.relayerUrl && { relayerUrl: options.relayerUrl }),
    },
  }
}
