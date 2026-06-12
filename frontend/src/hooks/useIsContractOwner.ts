import { useEffect, useState } from 'react'
import { useAddress } from './useAddress'
import { useChain } from '../contexts/ChainContext'
import { PolicyManagerAbi } from '../config/deployments'

/**
 * Returns whether the connected wallet is the PolicyManager owner.
 * `null` while the check is in flight, then `true` / `false`.
 */
export function useIsContractOwner(): boolean | null {
  const address = useAddress()
  const { publicClient, chainConfig } = useChain()
  const [isOwner, setIsOwner] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    if (!publicClient || !address || !chainConfig.policyManager) {
      setIsOwner(false)
      return
    }

    setIsOwner(null)
    publicClient
      .readContract({
        address: chainConfig.policyManager,
        abi: PolicyManagerAbi,
        functionName: 'owner',
      })
      .then((owner) => {
        if (cancelled) return
        setIsOwner((owner as string).toLowerCase() === address.toLowerCase())
      })
      .catch(() => {
        if (!cancelled) setIsOwner(false)
      })

    return () => {
      cancelled = true
    }
  }, [publicClient, address, chainConfig.policyManager])

  return isOwner
}
