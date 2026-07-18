import { CHAIN_CONFIGS, type ChainKey } from './chains'

// Chains a payer can pick at checkout. EVM chains are always offered because
// they share the merchant's single EVM payout address. Optional chains (Tempo,
// Arc) use dedicated wallet infra and must be opted into per plan by the
// merchant, so they only appear when listed in the plan's `supportedChains`.
export const EVM_CHECKOUT_CHAINS = (['flowEvm', 'base', 'arbitrum', 'polkadotHub'] as ChainKey[])
  .filter((k) => CHAIN_CONFIGS[k]?.policyManager)

export const OPTIONAL_CHECKOUT_CHAINS = (['tempo', 'arcTestnet'] as ChainKey[])
  .filter((k) => CHAIN_CONFIGS[k]?.policyManager)

/** Every chain a checkout can target (EVM defaults + optional). */
export const ALL_CHECKOUT_CHAINS = [...EVM_CHECKOUT_CHAINS, ...OPTIONAL_CHECKOUT_CHAINS]

/**
 * The chains a plan offers at checkout, given its merchant opt-in list.
 * EVM chains are always included; optional chains only when the merchant has
 * enabled them for the plan (`supportedChains` holds the opted-in optional keys).
 */
export function availableCheckoutChains(supportedChains?: string[]): ChainKey[] {
  const opted = new Set(supportedChains ?? [])
  return [
    ...EVM_CHECKOUT_CHAINS,
    ...OPTIONAL_CHECKOUT_CHAINS.filter((k) => opted.has(k)),
  ]
}
