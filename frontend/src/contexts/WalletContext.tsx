import * as React from 'react'
import { formatUnits, maxUint128, maxUint256 } from 'viem'
import { useAccount, useSwitchChain } from 'wagmi'
import { USDC_DECIMALS } from '../config'
import { erc20Abi } from '../config/contracts'
import { useChain } from './ChainContext'

interface WalletContextValue {
  address: `0x${string}` | undefined
  balance: string | null
  isLoading: boolean
  fetchBalance: () => Promise<void>
  isWalletSetup: boolean
  isSettingUp: boolean
  setupStatus: string
  setupError: string | null
  setupWallet: () => Promise<void>
}

const WalletContext = React.createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address, chainId: connectedChainId } = useAccount()
  const { publicClient, walletClient, chainConfig } = useChain()
  const { switchChainAsync } = useSwitchChain()
  const [balance, setBalance] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)

  // Wallet setup state
  const [isWalletSetup, setIsWalletSetup] = React.useState(false)
  const [isSettingUp, setIsSettingUp] = React.useState(false)
  const [setupStatus, setSetupStatus] = React.useState('')
  const [setupError, setSetupError] = React.useState<string | null>(null)

  // Pending approval — set after a chain switch so we auto-continue when walletClient appears
  const [pendingApproval, setPendingApproval] = React.useState(false)

  // Fetch balance
  const fetchBalance = React.useCallback(async () => {
    if (!publicClient || !address) return

    try {
      const rawBalance = await publicClient.readContract({
        address: chainConfig.usdc,
        abi: erc20Abi,
        functionName: 'balanceOf',
        args: [address],
      })
      setBalance(formatUnits(rawBalance, USDC_DECIMALS))
    } catch (err) {
      console.error('Failed to fetch balance:', err)
      setBalance(null)
    }
  }, [publicClient, address, chainConfig.usdc])

  // Check if wallet has USDC approval to PolicyManager
  const checkWalletSetup = React.useCallback(async () => {
    if (!publicClient || !address || !chainConfig.policyManager) {
      setIsWalletSetup(false)
      return
    }

    try {
      const allowance = await publicClient.readContract({
        address: chainConfig.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, chainConfig.policyManager],
      })
      const threshold = BigInt(1000) * BigInt(10 ** USDC_DECIMALS)
      setIsWalletSetup(allowance >= threshold)
    } catch (err) {
      console.error('Failed to check wallet setup:', err)
      setIsWalletSetup(false)
    }
  }, [publicClient, address, chainConfig.usdc, chainConfig.policyManager])

  // Core approval logic — called when walletClient is available
  const executeApproval = React.useCallback(async () => {
    if (!walletClient || !publicClient || !address || !chainConfig.policyManager) return

    setSetupStatus('Approving USDC...')

    try {
      const hash = await walletClient.writeContract({
        address: chainConfig.usdc,
        abi: erc20Abi,
        functionName: 'approve',
        args: [chainConfig.policyManager, chainConfig.chain.id === 420420419 ? maxUint128 : maxUint256],
      })

      setSetupStatus('Confirming...')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'reverted') {
        throw new Error('Approval transaction reverted on-chain')
      }

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
      setPendingApproval(false)
    }
  }, [walletClient, publicClient, address, chainConfig])

  // When walletClient appears after a chain switch and we have a pending approval, continue
  React.useEffect(() => {
    if (pendingApproval && walletClient) {
      executeApproval()
    }
  }, [pendingApproval, walletClient, executeApproval])

  // Setup wallet: approve unlimited USDC to PolicyManager
  const setupWallet = React.useCallback(async () => {
    if (!address) {
      throw new Error('Wallet not connected')
    }
    if (!chainConfig.policyManager) {
      throw new Error('PolicyManager not deployed on this chain')
    }

    setIsSettingUp(true)
    setSetupError(null)

    // If wallet is on the wrong chain, trigger a switch first
    const requiredChainId = chainConfig.chain.id
    if (connectedChainId !== requiredChainId) {
      try {
        setSetupStatus(`Switching to ${chainConfig.name}...`)
        await switchChainAsync({ chainId: requiredChainId })
        // walletClient won't update until React re-renders, so flag it
        setPendingApproval(true)
        return
      } catch {
        setSetupError(`Please switch your wallet to ${chainConfig.name}`)
        setSetupStatus('')
        setIsSettingUp(false)
        throw new Error(`Please switch your wallet to ${chainConfig.name}`)
      }
    }

    // Already on the right chain — approve directly
    await executeApproval()
  }, [address, connectedChainId, chainConfig, switchChainAsync, executeApproval])

  // Fetch balance and check setup when address changes
  React.useEffect(() => {
    if (address) {
      setIsLoading(true)
      Promise.all([fetchBalance(), checkWalletSetup()]).finally(() =>
        setIsLoading(false)
      )
    } else {
      setBalance(null)
      setIsWalletSetup(false)
    }
  }, [address, fetchBalance, checkWalletSetup])

  const value = React.useMemo(
    () => ({
      address,
      balance,
      isLoading,
      fetchBalance,
      isWalletSetup,
      isSettingUp,
      setupStatus,
      setupError,
      setupWallet,
    }),
    [address, balance, isLoading, fetchBalance, isWalletSetup, isSettingUp, setupStatus, setupError, setupWallet]
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
