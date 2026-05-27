import { useDisplayName } from '../../hooks/useEns'

interface AddressDisplayProps {
  address: string
  className?: string
  /** Show full ENS name or truncated address. Default: truncated */
  full?: boolean
  /** Show avatar circle before the name */
  avatar?: boolean
  /** Avatar size in pixels */
  avatarSize?: number
}

/**
 * Renders an Ethereum address with ENS resolution.
 * Shows ENS name if available, otherwise truncated hex address.
 * Drop-in replacement for `shortenAddress(address)` or inline `${addr.slice(0,6)}...${addr.slice(-4)}`.
 *
 * Usage:
 *   <AddressDisplay address="0x1234..." />
 *   <AddressDisplay address="0x1234..." avatar avatarSize={20} className="text-sm" />
 */
export function AddressDisplay({ address, className = '', full = false, avatar = false, avatarSize = 20 }: AddressDisplayProps) {
  const { displayName, ensAvatar, isEns } = useDisplayName(address)

  return (
    <span className={`inline-flex items-center gap-1.5 ${className}`} title={address}>
      {avatar && (
        ensAvatar
          ? <img src={ensAvatar} alt="" className="rounded-full shrink-0" style={{ width: avatarSize, height: avatarSize }} />
          : null
      )}
      <span className={isEns ? 'font-medium' : 'font-mono'}>
        {full && isEns ? displayName : displayName}
      </span>
    </span>
  )
}
