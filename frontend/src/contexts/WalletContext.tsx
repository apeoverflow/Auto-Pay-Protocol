import * as React from 'react'
import { encodeFunctionData, formatUnits, maxUint256 } from 'viem'
import { toWebAuthnAccount, type SmartAccount, type WebAuthnAccount } from 'viem/account-abstraction'
import { toCircleSmartAccount } from '@circle-fin/modular-wallets-core'
import { USDC_DECIMALS } from '../config'
import { erc20Abi } from '../config/contracts'
import { useAuth } from './AuthContext'
import { useChain } from './ChainContext'

interface WalletContextValue {
  account: SmartAccount | undefined
  balance: string | null
  isLoading: boolean
  fetchBalance: () => Promise<void>
  // Wallet setup (deployment + USDC approval)
  isWalletSetup: boolean
  isSettingUp: boolean
  setupStatus: string
  setupError: string | null
  setupWallet: () => Promise<void>
}

const WalletContext = React.createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { credential, username, logout } = useAuth()
  const { publicClient, circleClient, bundlerClient, chainConfig, chainKey } = useChain()
  const [account, setAccount] = React.useState<SmartAccount>()
  const [balance, setBalance] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  // Wallet setup state
  const [isWalletSetup, setIsWalletSetup] = React.useState(false)
  const [isSettingUp, setIsSettingUp] = React.useState(false)
  const [setupStatus, setSetupStatus] = React.useState('')
  const [setupError, setSetupError] = React.useState<string | null>(null)

  // Fetch balance function
  const fetchBalance = React.useCallback(async () => {
    if (!publicClient || !account?.address) return

    try {
      const rawBalance = await publicClient.readContract({
        address: chainConfig.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [account.address],
      })
      setBalance(formatUnits(rawBalance, USDC_DECIMALS))
    } catch (err) {
      console.error('Failed to fetch balance:', err)
      setBalance(null)
    }
  }, [publicClient, account?.address, chainConfig.usdc])

  // Check if wallet is set up (has USDC approval to PolicyManager)
  const checkWalletSetup = React.useCallback(async () => {
    if (!publicClient || !account?.address || !chainConfig.policyManager) {
      setIsWalletSetup(false)
      return
    }

    try {
      const allowance = await publicClient.readContract({
        address: chainConfig.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [account.address, chainConfig.policyManager],
      })
      // Consider "set up" if allowance is >= 1000 USDC (arbitrary threshold for "unlimited")
      const threshold = BigInt(1000) * BigInt(10 ** USDC_DECIMALS)
      setIsWalletSetup(allowance >= threshold)
    } catch (err) {
      console.error('Failed to check wallet setup:', err)
      setIsWalletSetup(false)
    }
  }, [publicClient, account?.address, chainConfig.usdc, chainConfig.policyManager])

  // Setup wallet: deploys smart account (if needed) + approves unlimited USDC to PolicyManager
  const setupWallet = React.useCallback(async () => {
    if (!account || !bundlerClient || !chainConfig.policyManager) {
      throw new Error('Wallet not ready')
    }

    setIsSettingUp(true)
    setSetupStatus('Setting up wallet...')
    setSetupError(null)

    try {
      // Encode USDC approval for unlimited amount
      const approveCallData = encodeFunctionData({
        abi: erc20Abi,
        functionName: 'approve',
        args: [chainConfig.policyManager, maxUint256],
      })

      // Send UserOperation - this will deploy the wallet if not deployed
      // and approve USDC to PolicyManager in one transaction
      const opHash = await bundlerClient.sendUserOperation({
        account,
        calls: [{ to: chainConfig.usdc, data: approveCallData }],
        paymaster: true,
        ...(chainConfig.minGasFees && {
          maxPriorityFeePerGas: chainConfig.minGasFees.maxPriorityFeePerGas,
          maxFeePerGas: chainConfig.minGasFees.maxFeePerGas,
        }),
      })

      setSetupStatus('Confirming...')

      await bundlerClient.waitForUserOperationReceipt({ hash: opHash })

      setSetupStatus('Wallet ready!')
      setIsWalletSetup(true)
    } catch (err) {
      console.error('Wallet setup failed:', err)
      const message = err instanceof Error ? err.message : 'Setup failed'
      setSetupError(message)
      setSetupStatus('')
      throw err
    } finally {
      setIsSettingUp(false)
    }
  }, [account, bundlerClient, chainConfig])

  // Create smart account from passkey credential
  // Re-create when chain changes to get proper client
  React.useEffect(() => {
    if (!credential || !circleClient) return

    setIsLoading(true)
    setBalance(null) // Clear balance while switching

    toCircleSmartAccount({
      client: circleClient,
      owner: toWebAuthnAccount({ credential }) as WebAuthnAccount,
      name: username,
    })
      .then(setAccount)
      .catch((err) => {
        console.error('Failed to create smart account:', err)
        // Credential is stale or invalid — force logout so user can re-authenticate
        logout()
      })
      .finally(() => setIsLoading(false))
  }, [credential, username, logout, circleClient, chainKey])

  // Fetch balance and check setup when account changes
  React.useEffect(() => {
    if (account?.address) {
      fetchBalance()
      checkWalletSetup()
    }
  }, [account?.address, fetchBalance, checkWalletSetup])

  // Clear account on logout
  React.useEffect(() => {
    if (!credential) {
      setAccount(undefined)
      setBalance(null)
    }
  }, [credential])

  const value = React.useMemo(
    () => ({
      account,
      balance,
      isLoading,
      fetchBalance,
      isWalletSetup,
      isSettingUp,
      setupStatus,
      setupError,
      setupWallet,
    }),
    [account, balance, isLoading, fetchBalance, isWalletSetup, isSettingUp, setupStatus, setupError, setupWallet]
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const context = React.useContext(WalletContext)
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider')
  }
  return context
}

