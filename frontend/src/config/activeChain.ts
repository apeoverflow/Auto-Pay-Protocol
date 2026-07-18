import { CHAIN_CONFIGS, DEFAULT_CHAIN, type ChainKey } from './chains'

// Shared localStorage key for the user's selected consolidation chain.
// Both the active-chain resolver (module-init wiring) and ChainContext
// (runtime state) must read/write the same key.
export const CHAIN_STORAGE_KEY = 'autopay:selectedChain'

/**
 * Resolve the active chain at module-init / root-render time.
 *
 * Reads the persisted selection from localStorage (guarded for SSR), validates
 * it against CHAIN_CONFIGS, and falls back to VITE_DEFAULT_CHAIN. This is the
 * single source of truth for the build-time wallet-mode gates (Privy for Tempo,
 * passkey for Arc, wagmi connectors) that must be wired before React renders.
 */
export function resolveActiveChainKey(): ChainKey {
  if (typeof window !== 'undefined') {
    const stored = window.localStorage.getItem(CHAIN_STORAGE_KEY) as ChainKey | null
    if (stored && CHAIN_CONFIGS[stored]) return stored
  }
  return DEFAULT_CHAIN
}
