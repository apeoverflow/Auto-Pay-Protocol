/**
 * Returns the connected wallet address, chain-aware.
 *
 * On Tempo builds, returns the local Tempo wallet address.
 * On Arc builds in passkey mode, returns the Circle smart account address.
 * Otherwise, returns the wagmi (injected wallet) address.
 *
 * Use this instead of `useAccount().address` in any hook that needs
 * the user's address for contract reads/writes.
 */
import { useAccount } from 'wagmi'
import { isTempoBuild, useTempoWallet } from '../contexts/TempoWalletContext'
import { isArcBuild, useArcWallet } from '../contexts/ArcWalletContext'

export function useAddress(): `0x${string}` | undefined {
  const { address: wagmiAddress } = useAccount()
  const tempoWallet = useTempoWallet()
  const arcWallet = useArcWallet()

  if (isTempoBuild()) {
    return tempoWallet.address ?? undefined
  }
  if (isArcBuild() && arcWallet.isPasskeyMode) {
    return arcWallet.address ?? undefined
  }
  return wagmiAddress
}
