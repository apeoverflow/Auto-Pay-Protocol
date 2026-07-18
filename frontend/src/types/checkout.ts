export type SubscriberFieldKey = 'email' | 'name' | 'discord' | 'telegram' | 'twitter' | 'mobile'

export interface CheckoutField {
  key: SubscriberFieldKey
  required: boolean
}

export interface CheckoutParams {
  merchant: `0x${string}`
  metadataUrl: string
  successUrl: string
  cancelUrl: string
  // Billing params — source of truth for on-chain values
  amount: string       // e.g. "9.99" (USDC)
  interval: number     // seconds
  spendingCap?: string // e.g. "119.88" — omit for unlimited (0 on-chain)
  /** IPFS metadata URL — fallback if metadataUrl (relayer) is unreachable */
  ipfsMetadataUrl?: string
  /** Subscriber info fields to collect during checkout */
  fields?: CheckoutField[]
  /** Preferred chain key to pre-select (e.g. 'base', 'arbitrum'). Payer can still
   *  switch among the plan's offered chains. */
  chain?: string
}

/** Display-only metadata fetched from metadataUrl. Billing info comes from CheckoutParams. */
export interface CheckoutMetadata {
  version: string
  plan: {
    name: string
    description: string
    tier?: string
    features?: string[]
  }
  merchant: {
    name: string
    logo?: string
    website?: string
    supportEmail?: string
  }
  display?: {
    color?: string
    badge?: string
  }
  /** Optional chains (e.g. 'tempo', 'arcTestnet') the merchant has enabled for
   *  this plan. EVM chains are always available regardless. */
  supportedChains?: string[]
}
