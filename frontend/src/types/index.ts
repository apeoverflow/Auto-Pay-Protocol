import type { Hex } from 'viem'
import type { P256Credential, SmartAccount } from 'viem/account-abstraction'

export interface AuthState {
  credential: P256Credential | null
  username: string | undefined
  isLoggedIn: boolean
}

export interface AuthActions {
  register: (username: string) => Promise<void>
  login: () => Promise<void>
  logout: () => void
}

export interface WalletState {
  account: SmartAccount | undefined
  balance: string | null
  isLoading: boolean
}

export interface TransferState {
  hash: Hex | undefined
  userOpHash: Hex | undefined
  status: string
  isLoading: boolean
}

export interface TransferActions {
  sendUSDC: (to: `0x${string}`, amount: string) => Promise<void>
  reset: () => void
}

export interface RecoveryState {
  showRecovery: boolean
  recoveryMnemonic: string | null
  recoveryStatus: string
  hasRecoveryKey: boolean
  recoveredAddress: string | null
  pendingRecoveryAccount: SmartAccount | null
  isLoading: boolean
}

export interface RecoveryActions {
  generateRecoveryKey: () => Promise<void>
  validateRecoveryPhrase: (mnemonic: string) => Promise<void>
  confirmRecovery: () => Promise<void>
  setShowRecovery: (show: boolean) => void
  clearRecovery: () => void
}

// Re-export viem types for convenience
export type { Hex, P256Credential, SmartAccount }

// Re-export subscription types
export * from './subscriptions'

// Re-export policy types
export * from './policy'

// Re-export checkout types
export * from './checkout'
