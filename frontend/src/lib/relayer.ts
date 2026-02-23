const RELAYER_URL = import.meta.env.VITE_RELAYER_URL || ''

/**
 * Resolve the relayer base URL for a given merchant address.
 * Prefers custom relayer config from localStorage, falls back to VITE_RELAYER_URL.
 * Returns { baseUrl, apiKey } — apiKey is empty string if not configured.
 */
function resolveRelayer(address: string): { baseUrl: string; apiKey: string } {
  const custom = getCustomRelayerConfig(address)
  const baseUrl = custom?.url || RELAYER_URL
  if (!baseUrl) {
    throw new Error('No relayer URL configured. Set VITE_RELAYER_URL or configure a custom relayer in Settings.')
  }
  return { baseUrl, apiKey: custom?.apiKey || '' }
}

// --- Custom relayer config (localStorage) ---

export interface CustomRelayerConfig {
  url: string
  apiKey: string
}

function isValidRelayerUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1'))
  } catch {
    return false
  }
}

export function getCustomRelayerConfig(address: string): CustomRelayerConfig | null {
  try {
    const raw = localStorage.getItem(`autopay_custom_relayer_${address.toLowerCase()}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed.url === 'string' && parsed.url.trim() && isValidRelayerUrl(parsed.url.trim())) {
      return { url: parsed.url.trim(), apiKey: parsed.apiKey || '' }
    }
    return null
  } catch {
    return null
  }
}

export function setCustomRelayerConfig(address: string, config: CustomRelayerConfig): void {
  localStorage.setItem(
    `autopay_custom_relayer_${address.toLowerCase()}`,
    JSON.stringify(config)
  )
}

export function clearCustomRelayerConfig(address: string): void {
  localStorage.removeItem(`autopay_custom_relayer_${address.toLowerCase()}`)
}

// --- Merchant stats ---

export interface MerchantStatsResponse {
  activeSubscribers: number
  totalRevenue: string
  chargeCount: number
}

export async function fetchMerchantStats(
  address: string,
  chainId: number,
): Promise<MerchantStatsResponse> {
  const { baseUrl, apiKey } = resolveRelayer(address)

  const headers: Record<string, string> = {}
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }

  const res = await fetch(
    `${baseUrl}/merchants/${encodeURIComponent(address)}/stats?chain_id=${encodeURIComponent(chainId)}`,
    { headers }
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch merchant stats: ${res.status}`)
  }

  const data: unknown = await res.json()

  // Validate response shape
  if (
    typeof data !== 'object' || data === null ||
    typeof (data as MerchantStatsResponse).activeSubscribers !== 'number' ||
    typeof (data as MerchantStatsResponse).totalRevenue !== 'string' ||
    typeof (data as MerchantStatsResponse).chargeCount !== 'number'
  ) {
    throw new Error('Invalid stats response from relayer')
  }

  return data as MerchantStatsResponse
}

type SignMessageFn = (args: { message: string }) => Promise<`0x${string}`>

// --- Types ---

export interface PlanSummary {
  id: string
  planName: string | null
  description: string | null
  tier: string | null
  amount: number | null
  intervalLabel: string | null
  spendingCap: number | null
  status: 'draft' | 'active' | 'archived'
  ipfsCid: string | null
  createdAt: string
  updatedAt: string
}

export interface PlanDetail {
  id: string
  merchantAddress: string
  metadata: Record<string, unknown>
  status: 'draft' | 'active' | 'archived'
  amount: number | null
  intervalLabel: string | null
  spendingCap: number | null
  ipfsCid: string | null
  createdAt: string
  updatedAt: string
}

// --- Auth helpers ---

export async function getAuthHeaders(
  address: string,
  signMessage: SignMessageFn,
): Promise<Record<string, string>> {
  const { baseUrl, apiKey } = resolveRelayer(address)

  // Step 1: Get nonce from relayer
  const nonceRes = await fetch(`${baseUrl}/auth/nonce?address=${encodeURIComponent(address)}`)
  if (!nonceRes.ok) {
    const err = await nonceRes.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to get nonce')
  }
  const { nonce, message } = (await nonceRes.json()) as { nonce: string; message: string }

  // Step 2: Validate message format to prevent signature phishing from malicious relayers.
  // The relayer must return a message matching: "AutoPay Authentication\nNonce: {nonce}\nIssued At: ..."
  const expectedPrefix = `AutoPay Authentication\nNonce: ${nonce}\n`
  if (typeof message !== 'string' || !message.startsWith(expectedPrefix)) {
    throw new Error('Relayer returned unexpected auth message format. Signing aborted for safety.')
  }

  // Step 3: Sign the validated message with user's wallet
  const signature = await signMessage({ message })

  const headers: Record<string, string> = {
    'X-Address': address,
    'X-Signature': signature,
    'X-Nonce': nonce,
  }
  if (apiKey) {
    headers['X-API-Key'] = apiKey
  }
  return headers
}

// --- Logo upload ---

export async function uploadLogo(
  address: string,
  file: File,
  signMessage: SignMessageFn,
): Promise<string> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/logos`, {
    method: 'POST',
    headers: { 'Content-Type': file.type, ...headers },
    body: file,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to upload logo')
  }
  const { filename } = (await res.json()) as { filename: string }
  return filename
}

// --- Read endpoints (no auth) ---

export async function listPlans(address: string, status?: string): Promise<PlanSummary[]> {
  const { baseUrl, apiKey } = resolveRelayer(address)
  const url = new URL(`${baseUrl}/merchants/${encodeURIComponent(address)}/plans`)
  if (status) url.searchParams.set('status', status)

  const headers: Record<string, string> = {}
  if (apiKey) headers['X-API-Key'] = apiKey

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) throw new Error('Failed to list plans')

  const data: unknown = await res.json()
  if (!Array.isArray(data)) throw new Error('Invalid plans response from relayer')
  const validStatuses = ['draft', 'active', 'archived']
  for (const item of data) {
    if (
      typeof item !== 'object' || item === null ||
      typeof item.id !== 'string' ||
      !validStatuses.includes(item.status)
    ) {
      throw new Error('Invalid plan item in response from relayer')
    }
  }
  return data as PlanSummary[]
}

export async function getPlan(address: string, planId: string): Promise<PlanDetail> {
  const { baseUrl, apiKey } = resolveRelayer(address)
  const headers: Record<string, string> = {}
  if (apiKey) headers['X-API-Key'] = apiKey

  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/plans/${encodeURIComponent(planId)}`, { headers })
  if (!res.ok) throw new Error('Failed to get plan')

  const data: unknown = await res.json()
  const validStatuses = ['draft', 'active', 'archived']
  if (
    typeof data !== 'object' || data === null ||
    typeof (data as PlanDetail).id !== 'string' ||
    !validStatuses.includes((data as PlanDetail).status) ||
    typeof (data as PlanDetail).metadata !== 'object' || (data as PlanDetail).metadata === null
  ) {
    throw new Error('Invalid plan response from relayer')
  }
  return data as PlanDetail
}

// --- Write endpoints (nonce -> sign -> headers) ---

export async function createPlan(
  address: string,
  body: Record<string, unknown>,
  signMessage: SignMessageFn,
): Promise<{ id: string }> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/plans`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to create plan')
  }

  const data: unknown = await res.json()
  if (typeof data !== 'object' || data === null || typeof (data as { id: string }).id !== 'string') {
    throw new Error('Invalid create plan response from relayer')
  }
  return data as { id: string }
}

export async function updatePlan(
  address: string,
  planId: string,
  body: Record<string, unknown>,
  signMessage: SignMessageFn,
): Promise<void> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/plans/${encodeURIComponent(planId)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to update plan')
  }
}

export async function patchPlan(
  address: string,
  planId: string,
  body: Record<string, unknown>,
  signMessage: SignMessageFn,
): Promise<void> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/plans/${encodeURIComponent(planId)}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to patch plan')
  }
}

export async function deletePlan(
  address: string,
  planId: string,
  signMessage: SignMessageFn,
): Promise<void> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/plans/${encodeURIComponent(planId)}`, {
    method: 'DELETE',
    headers: { ...headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to delete plan')
  }
}
