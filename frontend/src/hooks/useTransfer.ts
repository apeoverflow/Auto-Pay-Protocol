import * as React from 'react'
import { parseUnits, type Hex } from 'viem'
import { useAddress } from './useAddress'
import { useWallet } from '../contexts/WalletContext'
import { useChain } from '../contexts/ChainContext'
import { erc20Abi } from '../config/contracts'
import { USDC_DECIMALS } from '../config'
import { trackPayment } from '../lib/relayer'

interface UseTransferReturn {
  hash: Hex | undefined
  status: string
  isLoading: boolean
  sendUSDC: (to: `0x${string}`, amount: string) => Promise<void>
  reset: () => void
}

export function useTransfer(): UseTransferReturn {
  const address = useAddress()
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

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash })

        // Track the payment on the relayer (fire-and-forget)
        trackPayment({
          chainId: chainConfig.chain.id,
          from: address,
          to,
          amount: parseUnits(amount, USDC_DECIMALS).toString(),
          txHash,
          blockNumber: receipt.blockNumber ? Number(receipt.blockNumber) : undefined,
        })

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
