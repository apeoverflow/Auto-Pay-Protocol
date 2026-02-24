import { keccak256, toBytes } from 'viem'

type SignMessageFn = (args: { message: string }) => Promise<`0x${string}`>

/**
 * Derive the report encryption key by signing a deterministic message.
 * Returns the keccak256 hash of the signature as a hex string (0x-prefixed, 32 bytes).
 */
export async function deriveReportKey(
  signMessageAsync: SignMessageFn,
  address: string
): Promise<`0x${string}`> {
  const message = `AutoPay Report Key: ${address}`
  const signature = await signMessageAsync({ message })
  return keccak256(toBytes(signature))
}

/**
 * Decrypt an encrypted report blob using AES-256-GCM via Web Crypto API.
 * Expected format: [12-byte IV][ciphertext][16-byte auth tag]
 * Web Crypto expects: [ciphertext + auth tag] combined for AES-GCM decrypt.
 */
export async function decryptReport(
  encryptedBlob: ArrayBuffer,
  aesKeyHex: string
): Promise<unknown> {
  const data = new Uint8Array(encryptedBlob)

  if (data.length < 28) {
    // Minimum: 12 IV + 0 ciphertext + 16 tag
    throw new Error('Encrypted data too short')
  }

  const iv = data.slice(0, 12)
  // Web Crypto AES-GCM expects ciphertext + auth tag concatenated
  const ciphertextAndTag = data.slice(12)

  // Import the AES key
  const keyBytes = hexToBytes(aesKeyHex)
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    keyBytes.buffer as ArrayBuffer,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )

  // Decrypt
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    ciphertextAndTag
  )

  const json = new TextDecoder().decode(decrypted)
  return JSON.parse(json)
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const bytes = new Uint8Array(clean.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(clean.substring(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
