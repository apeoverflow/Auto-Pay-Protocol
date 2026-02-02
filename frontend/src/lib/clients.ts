import { createPublicClient } from 'viem'
import { polygonAmoy } from 'viem/chains'
import { createBundlerClient } from 'viem/account-abstraction'
import {
  toPasskeyTransport,
  toModularTransport,
} from '@circle-fin/modular-wallets-core'
import { clientKey, clientUrl, isConfigured } from '../config'

// Passkey transport for WebAuthn operations
export const passkeyTransport = isConfigured
  ? toPasskeyTransport(clientUrl!, clientKey!)
  : null

// Modular transport for blockchain operations
export const modularTransport = isConfigured
  ? toModularTransport(`${clientUrl}/polygonAmoy`, clientKey!)
  : null

// Public client for reading blockchain data
export const publicClient = modularTransport
  ? createPublicClient({
      chain: polygonAmoy,
      transport: modularTransport,
    })
  : null

// Bundler client for sending user operations
export const bundlerClient = modularTransport
  ? createBundlerClient({
      chain: polygonAmoy,
      transport: modularTransport,
    })
  : null

// Export chain for use elsewhere
export { polygonAmoy }
