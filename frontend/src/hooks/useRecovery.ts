import * as React from 'react'
import { english, generateMnemonic, mnemonicToAccount } from 'viem/accounts'
import type { SmartAccount } from 'viem/account-abstraction'
import {
  WebAuthnMode,
  toCircleSmartAccount,
  toWebAuthnCredential,
  recoveryActions,
} from '@circle-fin/modular-wallets-core'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { passkeyTransport } from '../lib/clients'
import { STORAGE_KEYS } from '../config'

interface UseRecoveryReturn {
  showRecovery: boolean
  recoveryMnemonic: string | null
  recoveryStatus: string
  hasRecoveryKey: boolean
  recoveredAddress: string | null
  isLoading: boolean
  generateRecoveryKey: () => Promise<void>
  validateRecoveryPhrase: (mnemonic: string) => Promise<void>
  confirmRecovery: () => Promise<void>
  setShowRecovery: (show: boolean) => void
  clearRecovery: () => void
}

export function useRecovery(): UseRecoveryReturn {
  const { account } = useWallet()
  const { publicClient, bundlerClient, chainConfig } = useChain()

  const [showRecovery, setShowRecovery] = React.useState(false)
  const [recoveryMnemonic, setRecoveryMnemonic] = React.useState<string | null>(null)
  const [recoveryStatus, setRecoveryStatus] = React.useState('')
  const [hasRecoveryKey, setHasRecoveryKey] = React.useState(
    () => localStorage.getItem(STORAGE_KEYS.HAS_RECOVERY_KEY) === 'true'
  )
  const [recoveredAddress, setRecoveredAddress] = React.useState<string | null>(null)
  const [pendingRecoveryAccount, setPendingRecoveryAccount] = React.useState<SmartAccount | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  const generateRecoveryKey = React.useCallback(async () => {
    if (!account || !bundlerClient) return

    setIsLoading(true)
    setRecoveryStatus('Generating recovery key...')

    try {
      const mnemonic = generateMnemonic(english)
      const recoveryEoa = mnemonicToAccount(mnemonic)

      const recoveryClient = bundlerClient.extend(recoveryActions)

      setRecoveryStatus('Registering recovery address on-chain (sign to authorize)...')

      await recoveryClient.registerRecoveryAddress({
        account,
        recoveryAddress: recoveryEoa.address,
        paymaster: true,
        // Arc's bundler requires minimum gas fees that the paymaster doesn't set correctly
        ...(chainConfig.minGasFees && {
          maxPriorityFeePerGas: chainConfig.minGasFees.maxPriorityFeePerGas,
          maxFeePerGas: chainConfig.minGasFees.maxFeePerGas,
        }),
      })

      setRecoveryMnemonic(mnemonic)
      setHasRecoveryKey(true)
      localStorage.setItem(STORAGE_KEYS.HAS_RECOVERY_KEY, 'true')
      setRecoveryStatus('Recovery key registered successfully!')
    } catch (err) {
      console.error('Failed to generate recovery key:', err)
      setRecoveryStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }, [account, bundlerClient, chainConfig])

  const validateRecoveryPhrase = React.useCallback(async (mnemonic: string) => {
    if (!publicClient) return

    setIsLoading(true)
    setRecoveryStatus('Validating recovery phrase...')
    setRecoveredAddress(null)
    setPendingRecoveryAccount(null)

    try {
      const localAccount = mnemonicToAccount(mnemonic.trim())

      const tempAccount = await toCircleSmartAccount({
        client: publicClient,
        owner: localAccount,
      })

      setRecoveredAddress(tempAccount.address)
      setPendingRecoveryAccount(tempAccount)
      setRecoveryStatus('Recovery phrase valid. Click "Confirm Recovery" to proceed.')
    } catch (err) {
      console.error('Invalid recovery phrase:', err)
      setRecoveryStatus(`Invalid recovery phrase: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }, [publicClient])

  const confirmRecovery = React.useCallback(async () => {
    if (!passkeyTransport || !bundlerClient || !pendingRecoveryAccount) return

    setIsLoading(true)
    setRecoveryStatus('Creating new passkey (follow browser prompt)...')

    try {
      const newCredential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Register,
        username: `recovered-${Date.now()}`,
      })

      setRecoveryStatus('Registering new passkey on-chain...')

      const recoveryClient = bundlerClient.extend(recoveryActions)

      await recoveryClient.executeRecovery({
        account: pendingRecoveryAccount,
        credential: newCredential,
        paymaster: true,
        // Arc's bundler requires minimum gas fees that the paymaster doesn't set correctly
        ...(chainConfig.minGasFees && {
          maxPriorityFeePerGas: chainConfig.minGasFees.maxPriorityFeePerGas,
          maxFeePerGas: chainConfig.minGasFees.maxFeePerGas,
        }),
      })

      // Update auth state with new credential
      localStorage.setItem(STORAGE_KEYS.CREDENTIAL, JSON.stringify(newCredential))
      localStorage.setItem(STORAGE_KEYS.AUTH_METHOD, 'passkey')

      // Clear recovery state
      setShowRecovery(false)
      setRecoveryStatus('')
      setRecoveredAddress(null)
      setPendingRecoveryAccount(null)

      // Reload to pick up new credentials
      window.location.reload()
    } catch (err) {
      console.error('Recovery failed:', err)
      setRecoveryStatus(`Recovery failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
    } finally {
      setIsLoading(false)
    }
  }, [pendingRecoveryAccount, bundlerClient, chainConfig])

  const clearRecovery = React.useCallback(() => {
    setRecoveryMnemonic(null)
    setRecoveryStatus('')
    setRecoveredAddress(null)
    setPendingRecoveryAccount(null)
  }, [])

  return {
    showRecovery,
    recoveryMnemonic,
    recoveryStatus,
    hasRecoveryKey,
    recoveredAddress,
    isLoading,
    generateRecoveryKey,
    validateRecoveryPhrase,
    confirmRecovery,
    setShowRecovery,
    clearRecovery,
  }
}
