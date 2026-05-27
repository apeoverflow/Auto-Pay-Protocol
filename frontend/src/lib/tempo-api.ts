/**
 * Tempo relayer API client
 *
 * On Tempo, transactions are executed server-side via the relayer using Privy's Node SDK.
 * The frontend authenticates with a Privy access token and sends transaction requests
 * to the relayer, which signs and broadcasts them via Privy's wallet infrastructure.
 */

const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || 'http://localhost:3420'

async function tempoRequest(path: string, accessToken: string, body?: Record<string, any>) {
  const res = await fetch(`${RELAYER_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ ...body }),
  })

  const data = await res.json()
  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`)
  }
  return data
}

export async function tempoCreateWallet(accessToken: string, email?: string): Promise<{ walletId: string; address: string }> {
  return tempoRequest('/api/tempo/create-wallet', accessToken, { email })
}

export async function tempoApprove(accessToken: string, walletId: string, walletAddress: string): Promise<{ hash: string }> {
  return tempoRequest('/api/tempo/approve', accessToken, { walletId, walletAddress })
}

export async function tempoCreatePolicy(
  accessToken: string,
  walletId: string,
  walletAddress: string,
  params: {
    merchant: string
    chargeAmount: string
    interval: number
    spendingCap: string
    metadataUrl?: string
  },
): Promise<{ hash: string; policyId?: string }> {
  return tempoRequest('/api/tempo/create-policy', accessToken, { walletId, walletAddress, ...params })
}

export async function tempoRevokePolicy(
  accessToken: string,
  walletId: string,
  walletAddress: string,
  policyId: string,
): Promise<{ hash: string }> {
  return tempoRequest('/api/tempo/revoke-policy', accessToken, { walletId, walletAddress, policyId })
}

export async function tempoSignMessage(
  accessToken: string,
  walletId: string,
  walletAddress: string,
  message: string,
): Promise<string> {
  const data = await tempoRequest('/api/tempo/sign-message', accessToken, { walletId, walletAddress, message })
  return data.signature
}

export async function tempoFund(
  accessToken: string,
  walletId: string,
  walletAddress: string,
  address: string,
): Promise<{ funded: boolean; hash?: string; amount?: string }> {
  return tempoRequest('/api/tempo/fund', accessToken, { walletId, walletAddress, address })
}
