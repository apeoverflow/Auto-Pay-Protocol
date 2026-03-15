/**
 * SS58 address encoding for Polkadot Hub.
 *
 * EVM addresses map to Substrate AccountId32 by appending 12 bytes of 0xEE.
 * The resulting 32-byte key is then SS58-encoded (base58 with a blake2b checksum).
 *
 * This is needed so users can receive DOT/USDC transfers from exchanges
 * and Substrate wallets, which only support SS58 addresses.
 */
import { blake2b } from '@noble/hashes/blake2.js'
import bs58 from 'bs58'

const SS58_PREFIX = new TextEncoder().encode('SS58PRE')

/**
 * Convert an EVM 0x address to its Polkadot Hub SS58 address.
 * Uses network prefix 0 (Polkadot).
 */
export function evmToSS58(evmAddress: string): string {
  // Strip 0x, lowercase, pad with 12 bytes of 0xEE
  const hex = evmAddress.slice(2).toLowerCase() + 'ee'.repeat(12)
  const payload = new Uint8Array(32)
  for (let i = 0; i < 32; i++) {
    payload[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }

  // SS58 encode with prefix 0 (Polkadot)
  const prefix = new Uint8Array([0])
  const checksumInput = new Uint8Array(SS58_PREFIX.length + 1 + 32)
  checksumInput.set(SS58_PREFIX, 0)
  checksumInput.set(prefix, SS58_PREFIX.length)
  checksumInput.set(payload, SS58_PREFIX.length + 1)

  const hash = blake2b(checksumInput, { dkLen: 64 })
  const checksum = hash.slice(0, 2)

  const full = new Uint8Array(1 + 32 + 2)
  full[0] = 0 // prefix
  full.set(payload, 1)
  full.set(checksum, 33)

  return bs58.encode(full)
}

/** Shorten an SS58 address for display: first 6 + last 4 */
export function shortenSS58(ss58: string): string {
  if (ss58.length <= 12) return ss58
  return `${ss58.slice(0, 6)}...${ss58.slice(-4)}`
}
