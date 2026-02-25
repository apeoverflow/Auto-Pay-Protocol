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

export interface BuildReceiptInput {
  policyId: string
  payer: string
  merchant: string
  amount: string
  protocolFee: string
  chainId: number
  txHash: string
  metadataUrl: string | null
  timestamp?: string
}

export function buildReceipt(input: BuildReceiptInput): ChargeReceipt {
  return {
    version: '1.0',
    type: 'charge_receipt',
    policyId: input.policyId,
    payer: input.payer,
    merchant: input.merchant,
    amount: input.amount,
    protocolFee: input.protocolFee,
    merchantReceived: computeMerchantReceived(input.amount, input.protocolFee),
    currency: 'USDC',
    chainId: input.chainId,
    txHash: input.txHash,
    blockNumber: null,
    timestamp: input.timestamp ?? new Date().toISOString(),
    policyMetadata: input.metadataUrl,
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
