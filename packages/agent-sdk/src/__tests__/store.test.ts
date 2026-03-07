import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { readFile, rm, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { MemoryStore, FileStore, type StoreEntry } from '../store'

// ── MemoryStore ──────────────────────────────────────────────────

describe('MemoryStore', () => {
  let store: MemoryStore

  beforeEach(() => {
    store = new MemoryStore()
  })

  it('returns null for unknown merchants', async () => {
    expect(await store.get('0xabc')).toBeNull()
  })

  it('stores and retrieves entries', async () => {
    const entry: StoreEntry = { policyId: '0xabc123' as `0x${string}` }
    await store.set('0xMerchant', entry)
    expect(await store.get('0xmerchant')).toEqual(entry)
  })

  it('normalises merchant keys to lowercase', async () => {
    const entry: StoreEntry = { policyId: '0xdef' as `0x${string}` }
    await store.set('0xABC', entry)
    expect(await store.get('0xabc')).toEqual(entry)
    expect(await store.get('0xABC')).toEqual(entry)
  })

  it('deletes entries', async () => {
    await store.set('0xabc', { policyId: '0x1' as `0x${string}` })
    await store.delete('0xABC')
    expect(await store.get('0xabc')).toBeNull()
  })

  it('returns all entries via all()', async () => {
    await store.set('0xa', { policyId: '0x1' as `0x${string}` })
    await store.set('0xb', { policyId: '0x2' as `0x${string}` })
    const all = await store.all()
    expect(all.size).toBe(2)
    expect(all.get('0xa')?.policyId).toBe('0x1')
  })

  it('all() returns a copy, not a reference', async () => {
    await store.set('0xa', { policyId: '0x1' as `0x${string}` })
    const all = await store.all()
    all.delete('0xa')
    expect(await store.get('0xa')).not.toBeNull()
  })
})

// ── FileStore ────────────────────────────────────────────────────

describe('FileStore', () => {
  let dir: string
  let filePath: string

  beforeEach(async () => {
    dir = join(tmpdir(), `autopay-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    await mkdir(dir, { recursive: true })
    filePath = join(dir, 'subs.json')
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('returns null when file does not exist', async () => {
    const store = new FileStore(filePath)
    expect(await store.get('0xabc')).toBeNull()
  })

  it('persists entries to disk', async () => {
    const store = new FileStore(filePath)
    await store.set('0xMerchant', { policyId: '0xpol1' as `0x${string}` })

    const raw = await readFile(filePath, 'utf-8')
    const data = JSON.parse(raw)
    expect(data['0xmerchant'].policyId).toBe('0xpol1')
  })

  it('reads back persisted entries on a new instance', async () => {
    const store1 = new FileStore(filePath)
    await store1.set('0xa', { policyId: '0x1' as `0x${string}`, token: 'tok', tokenExpiry: 999 })

    // New instance, fresh cache
    const store2 = new FileStore(filePath)
    const entry = await store2.get('0xa')
    expect(entry).toEqual({ policyId: '0x1', token: 'tok', tokenExpiry: 999 })
  })

  it('handles legacy plain-string format', async () => {
    // Write legacy format directly
    const { writeFile } = await import('node:fs/promises')
    await writeFile(filePath, JSON.stringify({ '0xmerch': '0xlegacy' }))

    const store = new FileStore(filePath)
    const entry = await store.get('0xmerch')
    expect(entry?.policyId).toBe('0xlegacy')
  })

  it('deletes entries and persists the deletion', async () => {
    const store = new FileStore(filePath)
    await store.set('0xa', { policyId: '0x1' as `0x${string}` })
    await store.delete('0xa')

    const store2 = new FileStore(filePath)
    expect(await store2.get('0xa')).toBeNull()
  })

  it('creates nested directories', async () => {
    const nestedPath = join(dir, 'deep', 'nested', 'subs.json')
    const store = new FileStore(nestedPath)
    await store.set('0xa', { policyId: '0x1' as `0x${string}` })

    const raw = await readFile(nestedPath, 'utf-8')
    expect(JSON.parse(raw)).toBeTruthy()
  })
})
