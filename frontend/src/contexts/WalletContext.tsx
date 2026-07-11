import * as React from 'react'
import { formatUnits, maxUint128, maxUint256 } from 'viem'
import { useAccount, useSwitchChain } from 'wagmi'
import { USDC_DECIMALS } from '../config'
import { erc20Abi } from '../config/contracts'
import { useChain } from './ChainContext'
import { isTempoBuild, useTempoWallet } from './TempoWalletContext'
import { isArcBuild, useArcWallet } from './ArcWalletContext'
import { tempoApprove } from '../lib/tempo-api'

interface WalletContextValue {
  address: `0x${string}` | undefined
  balance: string | null
  isLoading: boolean
  fetchBalance: () => Promise<void>
  isWalletSetup: boolean
  isSettingUp: boolean
  setupStatus: string
  setupError: string | null
  /** Current USDC allowance granted to the PolicyManager (raw, 6 decimals). */
  allowance: bigint
  /** True once the allowance has been read at least once. */
  allowanceLoaded: boolean
  /**
   * Approve USDC to the PolicyManager.
   * @param amount Exact allowance to set; omit for unlimited (maxUint256 / maxUint128 on Polkadot).
   */
  setupWallet: (amount?: bigint) => Promise<void>
}

const WalletContext = React.createContext<WalletContextValue | null>(null)

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const { address: wagmiAddress, chainId: connectedChainId } = useAccount()
  const tempoWallet = useTempoWallet()
  const arcWallet = useArcWallet()
  const isTempo = isTempoBuild()
  const isArc = isArcBuild()
  const isArcPasskey = isArc && arcWallet.isPasskeyMode

  // Address source follows the active wallet mode:
  //  - Tempo: server-side Privy wallet
  //  - Arc passkey: Circle smart account
  //  - Everything else: wagmi-connected browser wallet
  const address = isTempo
    ? tempoWallet.address ?? undefined
    : isArcPasskey
      ? arcWallet.address ?? undefined
      : wagmiAddress

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

  // Current allowance to PolicyManager (raw 6-decimal value)
  const [allowance, setAllowance] = React.useState<bigint>(0n)
  const [allowanceLoaded, setAllowanceLoaded] = React.useState(false)

  // Desired approval amount for the in-flight setup; undefined = unlimited
  const approvalAmountRef = React.useRef<bigint | undefined>(undefined)

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
      const current = await publicClient.readContract({
        address: chainConfig.usdc,
        abi: erc20Abi,
        functionName: 'allowance',
        args: [address, chainConfig.policyManager],
      })
      setAllowance(current)
      const threshold = BigInt(1000) * BigInt(10 ** USDC_DECIMALS)
      setIsWalletSetup(current >= threshold)
    } catch (err) {
      console.error('Failed to check wallet setup:', err)
      setIsWalletSetup(false)
    } finally {
      setAllowanceLoaded(true)
    }
  }, [publicClient, address, chainConfig.usdc, chainConfig.policyManager])

  // Core approval logic — called when walletClient is available (or via relayer for Tempo)
  const executeApproval = React.useCallback(async () => {
    if (!publicClient || !address || !chainConfig.policyManager) return

    setSetupStatus('Approving USDC...')

    try {
      let hash: `0x${string}`

      if (isTempo && tempoWallet.getAccessToken && tempoWallet.walletId && tempoWallet.address) {
        // Tempo: approve via relayer (server-side Privy wallet)
        const token = await tempoWallet.getAccessToken()
        if (!token) throw new Error('Not authenticated')
        const result = await tempoApprove(token, tempoWallet.walletId, tempoWallet.address)
        hash = result.hash as `0x${string}`
      } else {
        // Standard chains: approve via client-side walletClient.
        // Use the requested amount, or an unlimited sentinel when none is given.
        if (!walletClient) return
        const requested = approvalAmountRef.current
        const unlimited = chainConfig.chain.id === 420420419 ? maxUint128 : maxUint256
        const approveValue = requested === undefined ? unlimited : requested
        hash = await walletClient.writeContract({
          address: chainConfig.usdc,
          abi: erc20Abi,
          functionName: 'approve',
          args: [chainConfig.policyManager, approveValue],
        })
      }

      setSetupStatus('Confirming...')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })

      if (receipt.status === 'reverted') {
        throw new Error('Approval transaction reverted on-chain')
      }

      setSetupStatus('Wallet ready!')
      setIsWalletSetup(true)
      // Re-read the authoritative allowance now that approval landed
      await checkWalletSetup()
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
  }, [walletClient, publicClient, address, chainConfig, isTempo, tempoWallet, checkWalletSetup])

  // When walletClient appears after a chain switch and we have a pending approval, continue
  React.useEffect(() => {
    if (pendingApproval && walletClient) {
      executeApproval()
    }
  }, [pendingApproval, walletClient, executeApproval])

  // Setup wallet: approve USDC to PolicyManager (amount, or unlimited when omitted)
  const setupWallet = React.useCallback(async (amount?: bigint) => {
    if (!address) {
      throw new Error('Wallet not connected')
    }
    if (!chainConfig.policyManager) {
      throw new Error('PolicyManager not deployed on this chain')
    }

    approvalAmountRef.current = amount
    setIsSettingUp(true)
    setSetupError(null)

    // If wallet is on the wrong chain, trigger a switch first
    // Skip for Tempo and Arc passkey — there's no injected wallet to switch
    const requiredChainId = chainConfig.chain.id
    if (!isTempo && !isArcPasskey && connectedChainId !== requiredChainId) {
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
      allowance,
      allowanceLoaded,
      setupWallet,
    }),
    [address, balance, isLoading, fetchBalance, isWalletSetup, isSettingUp, setupStatus, setupError, allowance, allowanceLoaded, setupWallet]
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
