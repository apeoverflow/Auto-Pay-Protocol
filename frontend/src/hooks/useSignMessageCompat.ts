import { useCallback } from 'react'
import { useSignMessage } from 'wagmi'
import { isTempoBuild, useTempoWallet } from '../contexts/TempoWalletContext'
import { useWallet } from './useWallet'

type SignMessageFn = (args: { message: string }) => Promise<`0x${string}`>

/**
 * Returns a signMessageAsync function that works on both standard chains (wagmi)
 * and Tempo builds (server-side Privy signing via relayer).
 */
export function useSignMessageCompat(): { signMessageAsync: SignMessageFn } {
  const { signMessageAsync: wagmiSign } = useSignMessage()
  const tempoWallet = useTempoWallet()
  const { address } = useWallet()
  const isTempo = isTempoBuild()

  const signMessageAsync = useCallback<SignMessageFn>(async (args) => {
    if (isTempo && tempoWallet.walletId && tempoWallet.getAccessToken) {
      const token = await tempoWallet.getAccessToken()
      if (!token) throw new Error('Not authenticated')
      const { tempoSignMessage } = await import('../lib/tempo-api')
      const signature = await tempoSignMessage(
        token,
        tempoWallet.walletId,
        tempoWallet.address || address!,
        args.message,
      )
      return signature as `0x${string}`
    }
    if (!address) throw new Error('No wallet connected')
    return wagmiSign(args)
  }, [isTempo, tempoWallet, address, wagmiSign])

  return { signMessageAsync }
}
