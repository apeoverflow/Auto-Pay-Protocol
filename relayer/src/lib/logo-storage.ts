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
// S3-compatible backend (Supabase Storage or any S3-compatible service)
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
// Default logos directory (relayer root / logos)
// ---------------------------------------------------------------------------

const __dirname = dirname(fileURLToPath(import.meta.url))
const DEFAULT_LOGOS_DIR = join(__dirname, '..', '..', 'logos')

// ---------------------------------------------------------------------------
// Factory — reads env vars and creates the right backend
// ---------------------------------------------------------------------------

let _backend: LogoStorageBackend | null = null

export function getLogoStorage(): LogoStorageBackend {
  if (_backend) return _backend

  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY

  logger.info({
    hasSupabaseUrl: !!supabaseUrl,
    supabaseUrlPrefix: supabaseUrl?.slice(0, 30),
    hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasSupabaseKey: !!process.env.SUPABASE_KEY,
    resolvedKey: serviceRoleKey ? `${serviceRoleKey.slice(0, 10)}...` : 'none',
  }, 'Logo storage: env var check')

  if (supabaseUrl && serviceRoleKey) {
    logger.info({ supabaseUrl, bucket: 'logos' }, 'Using S3-compatible storage for logos (Supabase)')
    _backend = createSupabaseBackend(supabaseUrl, serviceRoleKey)
  } else {
    const logosDir = process.env.LOGOS_DIR || DEFAULT_LOGOS_DIR
    logger.info({ logosDir }, 'Using local filesystem for logos')
    _backend = createLocalBackend(logosDir)
  }

  return _backend
}

/** Reset singleton (for tests) */
export function resetLogoStorage(): void {
  _backend = null
}
