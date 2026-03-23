/**
 * Returns the connected wallet address, Tempo-aware.
 *
 * On Tempo builds, returns the local Tempo wallet address.
 * On other chains, returns the wagmi (injected wallet) address.
 *
 * Use this instead of `useAccount().address` in any hook that needs
 * the user's address for contract reads/writes.
 */
import { useAccount } from 'wagmi'
import { isTempoBuild, useTempoWallet } from '../contexts/TempoWalletContext'

export function useAddress(): `0x${string}` | undefined {
  const { address: wagmiAddress } = useAccount()
  const tempoWallet = useTempoWallet()

  if (isTempoBuild()) {
    return tempoWallet.address ?? undefined
  }
  return wagmiAddress
}
