/**
 * API routes — raffle status and live entry board.
 */

import { Router } from 'express'
import { config } from './config.js'
import { getAllEntries, getEntryCount, getConfirmedCount } from './db.js'

const router = Router()

// GET /api/status — raffle info + checkout URL
router.get('/api/status', (_req, res) => {
  res.json({
    name: 'AutoRaffle',
    description: 'Subscribe for $1 via AutoPay, enter to win a Ledger Nano X',
    chain: config.chainName,
    chainId: config.chain.chainId,
    merchant: config.merchantAddress,
    entryFee: `${config.entryFee} USDC`,
    totalEntries: getEntryCount(),
    confirmedEntries: getConfirmedCount(),
    subscribe: {
      url: config.checkoutUrl,
    },
  })
})

// GET /api/entries — live entry board (public)
router.get('/api/entries', (_req, res) => {
  const entries = getAllEntries()

  res.json({
    total: entries.length,
    entries: entries.map((e) => ({
      wallet: e.wallet_address,
      confirmed: !!e.tx_hash,
      enteredAt: e.created_at,
    })),
  })
})

export default router
