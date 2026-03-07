/**
 * Raffle tests — Node.js built-in test runner.
 * Run: node --test test/raffle.test.js
 */

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'

process.env.WEBHOOK_SECRET = ''
process.env.CHAIN = 'baseSepolia'

const { addEntry, getEntry, getAllEntries, getEntryCount, getConfirmedCount, confirmEntry } =
  await import('../src/db.js')

describe('Raffle entries', () => {
  it('adds an entry with wallet and policyId', () => {
    const entry = addEntry('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa', '0xpolicy111')
    assert.equal(entry.wallet_address, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    assert.equal(entry.policy_id, '0xpolicy111')
    assert.equal(entry.tx_hash, null)
  })

  it('upserts on duplicate wallet', () => {
    addEntry('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa', '0xpolicy222')
    const entry = getEntry('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa')
    assert.equal(entry.policy_id, '0xpolicy222')
  })

  it('confirms entry with tx hash', () => {
    confirmEntry('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa', '0xpolicy222', '0xtx456')
    const entry = getEntry('0xaAaAaAaaAaAaAaaAaAAAAAAAAaaaAaAaAaaAaaAa')
    assert.equal(entry.policy_id, '0xpolicy222')
    assert.equal(entry.tx_hash, '0xtx456')
  })

  it('counts entries correctly', () => {
    addEntry('0xbBbBBBBbbBBBbbbBbbBbbbbBBbBbbbbBbBbbBBbB', '0xpolicy333')
    assert.equal(getEntryCount(), 2)
    assert.equal(getConfirmedCount(), 1) // Only Alice has tx_hash
  })

  it('returns all entries ordered by newest first', () => {
    const entries = getAllEntries()
    assert.equal(entries.length, 2)
    assert.equal(entries[0].wallet_address, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
    assert.equal(entries[1].wallet_address, '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
  })

  it('lowercases wallet addresses', () => {
    const entry = getEntry('0xBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB')
    assert.equal(entry.wallet_address, '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb')
  })
})
