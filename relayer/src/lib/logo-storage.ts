import { mkdir, writeFile, readFile, stat } from 'fs/promises'
import { join, extname, dirname } from 'path'
import { fileURLToPath } from 'url'
import { randomUUID } from 'crypto'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('logo-storage')

// Reverse MIME lookup: content-type -> extension
const MIME_TO_EXT: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'image/webp': '.webp',
}

// Extension -> MIME type
const EXT_TO_MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
}

export interface LogoStorageBackend {
  /** Upload a logo, returns the filename/key */
  upload(body: Buffer, contentType: string): Promise<string>
  /** Serve a logo — returns { data, contentType } or null if not found */
  serve(filename: string): Promise<{ data: Buffer; contentType: string } | null>
  /** Get the public URL for a logo (if available), or null to use /logos/:filename proxy */
  publicUrl(filename: string): string | null
}

// ---------------------------------------------------------------------------
// Local filesystem backend (default for self-hosted relayers)
// ---------------------------------------------------------------------------

export function createLocalBackend(logosDir: string): LogoStorageBackend {
  return {
    async upload(body: Buffer, contentType: string): Promise<string> {
      const ext = MIME_TO_EXT[contentType]
      if (!ext) throw new Error(`Unsupported content type: ${contentType}`)

      const filename = `${randomUUID()}${ext}`
      await mkdir(logosDir, { recursive: true })
      await writeFile(join(logosDir, filename), body)
      logger.info({ filename, size: body.length }, 'Logo uploaded (local)')
      return filename
    },

    async serve(filename: string): Promise<{ data: Buffer; contentType: string } | null> {
      const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      if (sanitized !== filename) return null

      const logoPath = join(logosDir, sanitized)
      const ext = extname(sanitized).toLowerCase()
      const mimeType = EXT_TO_MIME[ext]
      if (!mimeType) return null

      try {
        await stat(logoPath)
        const data = await readFile(logoPath)
        return { data, contentType: mimeType }
      } catch {
        return null
      }
    },

    publicUrl(_filename: string): string | null {
      return null // use the /logos/:filename proxy
    },
  }
}

// ---------------------------------------------------------------------------
// Supabase Storage backend
// ---------------------------------------------------------------------------

export function createSupabaseBackend(supabaseUrl: string, serviceRoleKey: string, bucket = 'logos'): LogoStorageBackend {
  const storageBase = `${supabaseUrl}/storage/v1`

  return {
    async upload(body: Buffer, contentType: string): Promise<string> {
      const ext = MIME_TO_EXT[contentType]
      if (!ext) throw new Error(`Unsupported content type: ${contentType}`)

      const filename = `${randomUUID()}${ext}`

      // New-format keys (sb_secret_*) use apikey header; legacy JWTs use Authorization: Bearer
      const authHeaders: Record<string, string> = serviceRoleKey.startsWith('sb_secret_')
        ? { 'apikey': serviceRoleKey }
        : { 'Authorization': `Bearer ${serviceRoleKey}` }

      const res = await fetch(`${storageBase}/object/${bucket}/${filename}`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': contentType,
          'x-upsert': 'true',
        },
        body,
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`Supabase Storage upload failed (${res.status}): ${err}`)
      }

      logger.info({ filename, size: body.length, bucket }, 'Logo uploaded (supabase)')
      return filename
    },

    async serve(filename: string): Promise<{ data: Buffer; contentType: string } | null> {
      const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      if (sanitized !== filename) return null

      const ext = extname(sanitized).toLowerCase()
      const mimeType = Object.entries(MIME_TO_EXT).find(([, e]) => e === ext)?.[0]
      if (!mimeType) return null

      const res = await fetch(`${storageBase}/object/public/${bucket}/${sanitized}`)
      if (!res.ok) return null

      const data = Buffer.from(await res.arrayBuffer())
      return { data, contentType: mimeType }
    },

    publicUrl(filename: string): string | null {
      const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      if (sanitized !== filename) return null
      return `${storageBase}/object/public/${bucket}/${sanitized}`
    },
  }
}

// ---------------------------------------------------------------------------
// Generic S3-compatible backend (AWS S3, Cloudflare R2, MinIO, etc.)
// ---------------------------------------------------------------------------

interface S3Config {
  endpoint: string      // e.g. "https://s3.us-east-1.amazonaws.com" or "https://<account>.r2.cloudflarestorage.com"
  bucket: string        // e.g. "logos"
  region: string        // e.g. "us-east-1" or "auto" for R2
  accessKeyId: string
  secretAccessKey: string
  publicUrl?: string    // Optional public base URL (e.g. "https://logos.example.com" or R2 public bucket URL)
}

function hmacSha256(key: Buffer, data: string): Buffer {
  const { createHmac } = require('crypto')
  return createHmac('sha256', key).update(data).digest()
}

function sha256(data: string | Buffer): string {
  const { createHash } = require('crypto')
  return createHash('sha256').update(data).digest('hex')
}

function createS3Backend(config: S3Config): LogoStorageBackend {
  const { endpoint, bucket, region, accessKeyId, secretAccessKey, publicUrl: publicBaseUrl } = config

  // AWS Signature V4 signing
  function sign(method: string, path: string, headers: Record<string, string>, body: Buffer | ''): Record<string, string> {
    const now = new Date()
    const dateStamp = now.toISOString().replace(/[-:]/g, '').slice(0, 8)
    const amzDate = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '')

    const url = new URL(path, endpoint)
    const host = url.host

    const signedHeaderKeys = ['host', ...Object.keys(headers).map(h => h.toLowerCase())].sort()
    const canonicalHeaders = signedHeaderKeys.map(k => {
      if (k === 'host') return `host:${host}\n`
      const original = Object.keys(headers).find(h => h.toLowerCase() === k)!
      return `${k}:${headers[original].trim()}\n`
    }).join('')

    const payloadHash = sha256(body)

    const canonicalRequest = [
      method,
      url.pathname,
      url.search.replace('?', ''),
      canonicalHeaders,
      signedHeaderKeys.join(';'),
      payloadHash,
    ].join('\n')

    const credentialScope = `${dateStamp}/${region}/s3/aws4_request`
    const stringToSign = [
      'AWS4-HMAC-SHA256',
      amzDate,
      credentialScope,
      sha256(canonicalRequest),
    ].join('\n')

    const signingKey = hmacSha256(
      hmacSha256(
        hmacSha256(
          hmacSha256(Buffer.from(`AWS4${secretAccessKey}`), dateStamp),
          region,
        ),
        's3',
      ),
      'aws4_request',
    )
    const signature = hmacSha256(signingKey, stringToSign).toString('hex')

    return {
      ...headers,
      'Host': host,
      'x-amz-date': amzDate,
      'x-amz-content-sha256': payloadHash,
      'Authorization': `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderKeys.join(';')}, Signature=${signature}`,
    }
  }

  return {
    async upload(body: Buffer, contentType: string): Promise<string> {
      const ext = MIME_TO_EXT[contentType]
      if (!ext) throw new Error(`Unsupported content type: ${contentType}`)

      const filename = `${randomUUID()}${ext}`
      const path = `/${bucket}/${filename}`

      const headers = sign('PUT', path, { 'Content-Type': contentType }, body)

      const res = await fetch(`${endpoint}${path}`, {
        method: 'PUT',
        headers,
        body,
      })

      if (!res.ok) {
        const err = await res.text()
        throw new Error(`S3 upload failed (${res.status}): ${err}`)
      }

      logger.info({ filename, size: body.length, bucket }, 'Logo uploaded (s3)')
      return filename
    },

    async serve(filename: string): Promise<{ data: Buffer; contentType: string } | null> {
      const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      if (sanitized !== filename) return null

      const ext = extname(sanitized).toLowerCase()
      const mimeType = Object.entries(MIME_TO_EXT).find(([, e]) => e === ext)?.[0]
      if (!mimeType) return null

      const path = `/${bucket}/${sanitized}`
      const headers = sign('GET', path, {}, '')

      const res = await fetch(`${endpoint}${path}`, { headers })
      if (!res.ok) return null

      const data = Buffer.from(await res.arrayBuffer())
      return { data, contentType: mimeType }
    },

    publicUrl(filename: string): string | null {
      if (!publicBaseUrl) return null
      const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, '')
      if (sanitized !== filename) return null
      return `${publicBaseUrl.replace(/\/$/, '')}/${sanitized}`
    },
  }
}

// ---------------------------------------------------------------------------
// Default logos directory (relayer root / logos)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_LOGOS_DIR = join(__dirname, '..', '..', 'logos')

// ---------------------------------------------------------------------------
// Factory — reads env vars and creates the right backend
//
// Priority: S3_ENDPOINT > SUPABASE_URL > local filesystem
//
// S3-compatible (AWS, R2, MinIO):
//   S3_ENDPOINT, S3_BUCKET, S3_REGION, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY
//   S3_PUBLIC_URL (optional — for direct public access without proxy)
//
// Supabase Storage:
//   SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY)
//
// Local filesystem (default):
//   LOGOS_DIR (optional, defaults to <relayer>/logos/)
// ---------------------------------------------------------------------------

let _backend: LogoStorageBackend | null = null

export function getLogoStorage(): LogoStorageBackend {
  if (_backend) return _backend

  // S3-compatible
  const s3Endpoint = process.env.S3_ENDPOINT
  const s3Bucket = process.env.S3_BUCKET || 'logos'
  const s3Region = process.env.S3_REGION || 'auto'
  const s3AccessKey = process.env.S3_ACCESS_KEY_ID
  const s3SecretKey = process.env.S3_SECRET_ACCESS_KEY
  const s3PublicUrl = process.env.S3_PUBLIC_URL

  if (s3Endpoint && s3AccessKey && s3SecretKey) {
    logger.info({ endpoint: s3Endpoint, bucket: s3Bucket, region: s3Region, hasPublicUrl: !!s3PublicUrl }, 'Using S3-compatible storage for logos')
    _backend = createS3Backend({ endpoint: s3Endpoint, bucket: s3Bucket, region: s3Region, accessKeyId: s3AccessKey, secretAccessKey: s3SecretKey, publicUrl: s3PublicUrl })
    return _backend
  }

  // Supabase Storage
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

  if (supabaseUrl && serviceRoleKey) {
    logger.info({ supabaseUrl, bucket: 'logos' }, 'Using Supabase Storage for logos')
    _backend = createSupabaseBackend(supabaseUrl, serviceRoleKey)
    return _backend
  }

  // Local filesystem fallback
  const logosDir = process.env.LOGOS_DIR || DEFAULT_LOGOS_DIR
  logger.info({ logosDir }, 'Using local filesystem for logos')
  _backend = createLocalBackend(logosDir)
  return _backend
}

/** Reset singleton (for tests) */
export function resetLogoStorage(): void {
  _backend = null
}
