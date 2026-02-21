import * as React from 'react'
import { parseUnits, type Hex } from 'viem'
import { useAccount } from 'wagmi'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { erc20Abi } from '../config/contracts'
import { USDC_DECIMALS } from '../config'

interface UseTransferReturn {
  hash: Hex | undefined
  status: string
  isLoading: boolean
  sendUSDC: (to: `0x${string}`, amount: string) => Promise<void>
  reset: () => void
}

export function useTransfer(): UseTransferReturn {
  const { address } = useAccount()
  const { fetchBalance } = useWallet()
  const { walletClient, publicClient, chainConfig } = useChain()
  const [hash, setHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const sendUSDC = React.useCallback(
    async (to: `0x${string}`, amount: string) => {
      if (!address || !walletClient || !publicClient) return

      setIsLoading(true)
      setStatus('Sending...')
      setHash(undefined)

      try {
        const txHash = await walletClient.writeContract({
          address: chainConfig.usdc,
          abi: erc20Abi,
          functionName: 'transfer',
          args: [to, parseUnits(amount, USDC_DECIMALS)],
        })

        setHash(txHash)
        setStatus('Waiting for confirmation...')

        await publicClient.waitForTransactionReceipt({ hash: txHash })

        setStatus('Confirmed')
        await fetchBalance()
      } catch (err) {
        console.error('Transfer failed:', err)
        setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setIsLoading(false)
      }
    },
    [address, fetchBalance, walletClient, publicClient, chainConfig.usdc]
  )

  const reset = React.useCallback(() => {
    setHash(undefined)
    setStatus('')
  }, [])

  return {
    hash,
    status,
    isLoading,
    sendUSDC,
    reset,
  }
}
