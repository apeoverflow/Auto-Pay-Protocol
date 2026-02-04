import { toPasskeyTransport } from '@circle-fin/modular-wallets-core'
import { clientKey, clientUrl, isConfigured } from '../config'

// Passkey transport for WebAuthn operations
// This is chain-agnostic and used for credential creation/login
export const passkeyTransport = isConfigured
  ? toPasskeyTransport(clientUrl!, clientKey!)
  : null
