import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import { keccak256, toBytes } from 'viem'

/**
 * Derive a 32-byte AES-256 encryption key from a wallet signature.
 * The signature is hashed with keccak256 to produce a deterministic key.
 */
export function deriveEncryptionKey(signature: string): Buffer {
  const hash = keccak256(toBytes(signature))
  return Buffer.from(hash.slice(2), 'hex') // 32 bytes
}

/**
 * Encrypt a JSON report string using AES-256-GCM.
 * Returns a single buffer: [12-byte IV][ciphertext][16-byte auth tag]
 */
export function encryptReport(reportJson: string, aesKey: Buffer): Buffer {
  const iv = randomBytes(12) // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', aesKey, iv)

  const encrypted = Buffer.concat([
    cipher.update(reportJson, 'utf8'),
    cipher.final(),
  ])

  const authTag = cipher.getAuthTag() // 16 bytes

  return Buffer.concat([iv, encrypted, authTag])
}

/**
 * Decrypt an AES-256-GCM encrypted report.
 * Input format: [12-byte IV][ciphertext][16-byte auth tag]
 * Compatible with Web Crypto API (browser passes data.slice(12) to decrypt).
 */
export function decryptReport(packed: Buffer, aesKey: Buffer): string {
  const iv = packed.subarray(0, 12)
  const authTag = packed.subarray(packed.length - 16)
  const ciphertext = packed.subarray(12, packed.length - 16)

  const decipher = createDecipheriv('aes-256-gcm', aesKey, iv)
  decipher.setAuthTag(authTag)

  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ])

  return decrypted.toString('utf8')
}
