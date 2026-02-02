import * as React from 'react'
import { parseUnits, type Hex } from 'viem'
import { encodeTransfer } from '@circle-fin/modular-wallets-core'
import { useWallet, bundlerClient } from '../contexts/WalletContext'
import { USDC_ADDRESS, USDC_DECIMALS } from '../config'

interface UseTransferReturn {
  hash: Hex | undefined
  userOpHash: Hex | undefined
  status: string
  isLoading: boolean
  sendUSDC: (to: `0x${string}`, amount: string) => Promise<void>
  reset: () => void
}

export function useTransfer(): UseTransferReturn {
  const { account, fetchBalance } = useWallet()
  const [hash, setHash] = React.useState<Hex>()
  const [userOpHash, setUserOpHash] = React.useState<Hex>()
  const [status, setStatus] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const sendUSDC = React.useCallback(
    async (to: `0x${string}`, amount: string) => {
      if (!account || !bundlerClient) return

      setIsLoading(true)
      setStatus('Sending...')
      setHash(undefined)
      setUserOpHash(undefined)

      try {
        const callData = encodeTransfer(
          to,
          USDC_ADDRESS,
          parseUnits(amount, USDC_DECIMALS)
        )

        const opHash = await bundlerClient.sendUserOperation({
          account,
          calls: [callData],
          paymaster: true,
        })

        setUserOpHash(opHash)
        setStatus('Waiting for confirmation...')

        const { receipt } = await bundlerClient.waitForUserOperationReceipt({
          hash: opHash,
        })

        setHash(receipt.transactionHash)
        setStatus('Confirmed')

        // Refresh balance after sending
        await fetchBalance()
      } catch (err) {
        console.error('Transfer failed:', err)
        setStatus(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`)
      } finally {
        setIsLoading(false)
      }
    },
    [account, fetchBalance]
  )

  const reset = React.useCallback(() => {
    setHash(undefined)
    setUserOpHash(undefined)
    setStatus('')
  }, [])

  return {
    hash,
    userOpHash,
    status,
    isLoading,
    sendUSDC,
    reset,
  }
}
