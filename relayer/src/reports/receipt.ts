import type { PolicyRow, ChargeResult, ChainConfig } from '../types.js'
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

export function buildReceipt(
  policy: PolicyRow,
  chargeResult: ChargeResult,
  chainConfig: ChainConfig,
): ChargeReceipt {
  const amount = chargeResult.amount ?? policy.charge_amount
  const protocolFee = chargeResult.protocolFee ?? '0'

  // Compute merchant received: amount - protocolFee (both in USDC atomic units)
  let merchantReceived: string
  try {
    const amountBig = BigInt(amount)
    const feeBig = BigInt(protocolFee)
    merchantReceived = (amountBig - feeBig).toString()
  } catch {
    merchantReceived = amount
  }

  return {
    version: '1.0',
    type: 'charge_receipt',
    policyId: policy.id,
    payer: policy.payer,
    merchant: policy.merchant,
    amount,
    protocolFee,
    merchantReceived,
    currency: 'USDC',
    chainId: chainConfig.chainId,
    txHash: chargeResult.txHash!,
    blockNumber: null,
    timestamp: new Date().toISOString(),
    policyMetadata: policy.metadata_url,
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
