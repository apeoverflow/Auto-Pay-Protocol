/**
 * SQLite database — zero-setup, file-based.
 * Creates raffle.db in the project root on first run.
 */

import Database from 'better-sqlite3'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '..', 'raffle.db')

const db = new Database(DB_PATH)

db.pragma('journal_mode = WAL')

// ── Schema ─────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    wallet_address TEXT NOT NULL,
    policy_id TEXT,
    tx_hash TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(wallet_address)
  );
`)

// ── Entries ────────────────────────────────────────────────────

export function addEntry(walletAddress, policyId) {
  const stmt = db.prepare(`
    INSERT INTO entries (wallet_address, policy_id)
    VALUES (?, ?)
    ON CONFLICT(wallet_address) DO UPDATE SET
      policy_id = COALESCE(excluded.policy_id, entries.policy_id)
  `)
  stmt.run(walletAddress.toLowerCase(), policyId)
  return getEntry(walletAddress)
}

export function confirmEntry(walletAddress, policyId, txHash) {
  db.prepare(`
    UPDATE entries SET policy_id = ?, tx_hash = ? WHERE wallet_address = ?
  `).run(policyId, txHash, walletAddress.toLowerCase())
  return getEntry(walletAddress)
}

export function getEntry(walletAddress) {
  return db.prepare('SELECT * FROM entries WHERE wallet_address = ?').get(walletAddress.toLowerCase())
}

export function getAllEntries() {
  return db.prepare('SELECT * FROM entries ORDER BY id DESC').all()
}

export function getEntryCount() {
  return db.prepare('SELECT COUNT(*) as count FROM entries').get().count
}

export function getConfirmedCount() {
  return db.prepare('SELECT COUNT(*) as count FROM entries WHERE tx_hash IS NOT NULL').get().count
}

export default db
