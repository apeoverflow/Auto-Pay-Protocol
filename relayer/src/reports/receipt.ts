import type { PolicyRow, ChargeResult, ChainConfig } from '../types.js'
import type { ReceiptPendingRow } from '../db/charges.js'
import { uploadJSON, isStorachaEnabled } from '../lib/storacha.js'
import { createLogger } from '../utils/logger.js'

const logger = createLogger('reports:receipt')

export interface ChargeReceipt {
  version: '1.0'
  type: 'charge_receipt'
  policyId: string
  payer: string
  merchant: string
  amount: string
  protocolFee: string
  merchantReceived: string
  currency: 'USDC'
  chainId: number
  txHash: string
  blockNumber: null
  timestamp: string
  policyMetadata: string | null
}

function computeMerchantReceived(amount: string, protocolFee: string): string {
  try {
    return (BigInt(amount) - BigInt(protocolFee)).toString()
  } catch {
    return amount
  }
}

export function buildReceipt(
  policy: PolicyRow,
  chargeResult: ChargeResult,
  chainConfig: ChainConfig,
  completedAt: Date,
): ChargeReceipt {
  if (!chargeResult.txHash) {
    throw new Error(`Cannot build receipt: txHash missing for policy ${policy.id}`)
  }

  const amount = chargeResult.amount ?? policy.charge_amount
  const protocolFee = chargeResult.protocolFee ?? '0'

  return {
    version: '1.0',
    type: 'charge_receipt',
    policyId: policy.id,
    payer: policy.payer,
    merchant: policy.merchant,
    amount,
    protocolFee,
    merchantReceived: computeMerchantReceived(amount, protocolFee),
    currency: 'USDC',
    chainId: chainConfig.chainId,
    txHash: chargeResult.txHash,
    blockNumber: null,
    timestamp: completedAt.toISOString(),
    policyMetadata: policy.metadata_url,
  }
}

/**
 * Build a receipt from a DB row (used by the retry loop).
 * Uses the same structure as buildReceipt to ensure consistency.
 */
export function buildReceiptFromRow(row: ReceiptPendingRow): ChargeReceipt {
  const protocolFee = row.protocol_fee ?? '0'

  return {
    version: '1.0',
    type: 'charge_receipt',
    policyId: row.policy_id,
    payer: row.payer,
    merchant: row.merchant,
    amount: row.amount,
    protocolFee,
    merchantReceived: computeMerchantReceived(row.amount, protocolFee),
    currency: 'USDC',
    chainId: row.chain_id,
    txHash: row.tx_hash,
    blockNumber: null,
    timestamp: row.completed_at?.toISOString() ?? new Date().toISOString(),
    policyMetadata: row.metadata_url,
  }
}

export async function uploadChargeReceipt(receipt: ChargeReceipt): Promise<string> {
  const cid = await uploadJSON(receipt)
  logger.info(
    { policyId: receipt.policyId, cid, txHash: receipt.txHash },
    'Uploaded charge receipt to IPFS',
  )
  return cid
}

export { isStorachaEnabled }
