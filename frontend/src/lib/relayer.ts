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

// --- Subscriber data ---

/**
 * Submit subscriber form data after policy creation.
 * Retries on 404 (policy not yet indexed by relayer) with exponential backoff.
 */
export async function submitSubscriberData(data: {
  policyId: string
  chainId: number
  payer: string
  merchant: string
  planId?: string
  planMerchant?: string
  formData: Record<string, string>
}): Promise<void> {
  const { baseUrl } = resolveRelayer(data.merchant)
  const maxAttempts = 5
  const backoffMs = [2000, 4000, 8000, 16000, 30000]

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetch(`${baseUrl}/subscribers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) return

    const err = await res.json().catch(() => ({}))
    // Retry only on 404 (policy not indexed yet); other errors are permanent
    if (res.status !== 404 || attempt === maxAttempts - 1) {
      throw new Error((err as { error?: string }).error || 'Failed to submit subscriber data')
    }
    await new Promise((r) => setTimeout(r, backoffMs[attempt]))
  }
}

// --- Checkout links ---

export interface CheckoutLinkData {
  merchant: string
  metadataUrl: string
  amount: string | number
  interval: number
  spendingCap?: string | number
  ipfsMetadataUrl?: string | null
  successUrl?: string | null
  cancelUrl?: string | null
  fields?: string
}

export async function resolveCheckoutLink(shortId: string): Promise<CheckoutLinkData> {
  const baseUrl = RELAYER_URL
  if (!baseUrl) {
    throw new Error('No relayer URL configured. Set VITE_RELAYER_URL.')
  }
  return resolveCheckoutLinkFromUrl(baseUrl, shortId)
}

export async function resolveCheckoutLinkFromUrl(relayerBaseUrl: string, shortId: string): Promise<CheckoutLinkData> {
  // Validate the relayer URL to prevent SSRF / phishing via ?relayer= param
  try {
    const parsed = new URL(relayerBaseUrl)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error('Invalid relayer URL protocol')
    }
  } catch {
    throw new Error('Invalid relayer URL')
  }

  const res = await fetch(`${relayerBaseUrl}/checkout-links/${encodeURIComponent(shortId)}`)
  if (res.status === 404) {
    throw new Error('Checkout link not found')
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to resolve checkout link')
  }
  return (await res.json()) as CheckoutLinkData
}

export interface CreateCheckoutLinkResponse {
  shortId: string
  isCustomRelayer: boolean
  relayerBaseUrl: string
}

export async function createCheckoutLink(
  address: string,
  body: { planId: string; successUrl?: string; cancelUrl?: string; fields?: string; slug?: string },
  signMessage: SignMessageFn,
): Promise<CreateCheckoutLinkResponse> {
  const { baseUrl } = resolveRelayer(address)
  const isCustomRelayer = !!getCustomRelayerConfig(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/checkout-links`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to create checkout link')
  }
  const data = (await res.json()) as { shortId: string }
  return {
    shortId: data.shortId,
    isCustomRelayer,
    relayerBaseUrl: baseUrl,
  }
}

// --- Subscriber list (auth-protected) ---

export interface MerchantSubscriber {
  policyId: string
  chainId: number
  payer: string
  planId: string | null
  formData: Record<string, string>
  active: boolean
  chargeAmount: string
  intervalSeconds: number
  createdAt: string
}

export interface MerchantSubscribersResponse {
  subscribers: MerchantSubscriber[]
  total: number
  page: number
  limit: number
}

export async function fetchMerchantSubscribers(
  address: string,
  signMessage: SignMessageFn,
  chainId?: number,
  planId?: string,
  page = 1,
  limit = 50,
): Promise<MerchantSubscribersResponse> {
  const { baseUrl, apiKey } = resolveRelayer(address)

  const url = new URL(`${baseUrl}/merchants/${encodeURIComponent(address)}/subscribers`)
  if (chainId != null) url.searchParams.set('chain_id', String(chainId))
  if (planId) url.searchParams.set('plan_id', planId)
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))

  // Try API key first (custom/self-hosted relayer) — avoids wallet prompt
  if (apiKey) {
    const res = await fetch(url.toString(), { headers: { 'X-API-Key': apiKey } })
    if (res.ok) return (await res.json()) as MerchantSubscribersResponse
    if (res.status !== 401) {
      const err = await res.json().catch(() => ({}))
      throw new Error((err as { error?: string }).error || 'Failed to fetch subscribers')
    }
  }

  // Fall back to signature auth (default AutoPay relayer)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to fetch subscribers')
  }

  return (await res.json()) as MerchantSubscribersResponse
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
  if (typeof window === 'undefined') return null
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
  chainId?: number,
): Promise<MerchantStatsResponse> {
  const { baseUrl } = resolveRelayer(address)

  const url = new URL(`${baseUrl}/merchants/${encodeURIComponent(address)}/stats`)
  if (chainId != null) url.searchParams.set('chain_id', String(chainId))
  const res = await fetch(
    url.toString(),
  )
  if (!res.ok) {
    throw new Error(`Failed to fetch merchant stats: ${res.status}`)
  }

  const data: unknown = await res.json()

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

// --- Merchant charges ---

export interface MerchantCharge {
  id: number
  policyId: string
  chainId: number
  payer: string
  merchant: string
  amount: string
  protocolFee: string | null
  txHash: string | null
  receiptCid: string | null
  completedAt: string | null
  createdAt: string
}

export interface MerchantChargesResponse {
  charges: MerchantCharge[]
  total: number
  page: number
  limit: number
}

export async function fetchMerchantCharges(
  address: string,
  chainId?: number,
  page = 1,
  limit = 50,
): Promise<MerchantChargesResponse> {
  const { baseUrl, apiKey } = resolveRelayer(address)

  const headers: Record<string, string> = {}
  if (apiKey) headers['X-API-Key'] = apiKey

  const url = new URL(`${baseUrl}/merchants/${encodeURIComponent(address)}/charges`)
  if (chainId != null) url.searchParams.set('chain_id', String(chainId))
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    throw new Error(`Failed to fetch merchant charges: ${res.status}`)
  }

  const data: unknown = await res.json()
  if (
    typeof data !== 'object' || data === null ||
    !Array.isArray((data as MerchantChargesResponse).charges)
  ) {
    throw new Error('Invalid charges response from relayer')
  }

  return data as MerchantChargesResponse
}

// --- Receipt upload ---

export interface UploadReceiptsResponse {
  uploaded: { chargeId: number; cid: string; ipfsUrl: string }[]
  skipped: number[]
  failed: { chargeId: number; error: string }[]
  invalidIds: number[]
}

export async function uploadChargeReceipts(
  address: string,
  chargeIds: number[],
  chainId: number,
  signMessage: SignMessageFn,
): Promise<UploadReceiptsResponse> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/receipts/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ chargeIds, chainId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to upload receipts')
  }
  return (await res.json()) as UploadReceiptsResponse
}

// --- Payer receipt upload ---

export async function uploadPayerChargeReceipts(
  address: string,
  chargeIds: number[],
  chainId: number,
  signMessage: SignMessageFn,
): Promise<UploadReceiptsResponse> {
  const baseUrl = RELAYER_URL
  if (!baseUrl) {
    throw new Error('No relayer URL configured. Set VITE_RELAYER_URL.')
  }

  // Inline auth against the same baseUrl (payers always use the canonical relayer,
  // not a merchant-custom one, so we avoid resolveRelayer here)
  const nonceRes = await fetch(`${baseUrl}/auth/nonce?address=${encodeURIComponent(address)}`)
  if (!nonceRes.ok) {
    const err = await nonceRes.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to get nonce')
  }
  const { nonce, message } = (await nonceRes.json()) as { nonce: string; message: string }

  const expectedPrefix = `AutoPay Authentication\nNonce: ${nonce}\n`
  if (typeof message !== 'string' || !message.startsWith(expectedPrefix)) {
    throw new Error('Relayer returned unexpected auth message format. Signing aborted for safety.')
  }

  const signature = await signMessage({ message })
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Address': address,
    'X-Signature': signature,
    'X-Nonce': nonce,
  }

  const res = await fetch(`${baseUrl}/payers/${encodeURIComponent(address)}/receipts/upload`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ chargeIds, chainId }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to upload receipts')
  }
  return (await res.json()) as UploadReceiptsResponse
}

// --- Merchant reports ---

export interface MerchantReport {
  period: string
  cid: string | null
  ipfsUrl: string | null
  createdAt: string
}

export async function fetchMerchantReports(
  address: string,
  chainId?: number,
): Promise<MerchantReport[]> {
  const { baseUrl, apiKey } = resolveRelayer(address)

  const headers: Record<string, string> = {}
  if (apiKey) headers['X-API-Key'] = apiKey

  const url = new URL(`${baseUrl}/merchants/${encodeURIComponent(address)}/reports`)
  if (chainId != null) url.searchParams.set('chain_id', String(chainId))

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    throw new Error(`Failed to fetch merchant reports: ${res.status}`)
  }

  const data: unknown = await res.json()
  if (!Array.isArray(data)) {
    throw new Error('Invalid reports response from relayer')
  }

  return data as MerchantReport[]
}

// --- Generate report on-demand ---

export interface GenerateReportResponse {
  cid: string | null
  period: string
  ipfsUrl: string | null
}

export async function generateMerchantReport(
  address: string,
  chainId: number,
  signMessage: (args: { message: string }) => Promise<`0x${string}`>,
  period?: string,
  uploadToIpfs?: boolean,
): Promise<GenerateReportResponse> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const body: Record<string, unknown> = { chainId }
  if (period) body.period = period
  if (uploadToIpfs !== undefined) body.uploadToIpfs = uploadToIpfs

  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to generate report')
  }

  return (await res.json()) as GenerateReportResponse
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

// Deduplicates concurrent getAuthHeaders calls for the same address so the
// wallet only prompts for one signature even if multiple requests fire at once
// (e.g. React Strict Mode double-mount or rapid dependency changes).
const pendingAuth = new Map<string, Promise<Record<string, string>>>()

export function getAuthHeaders(
  address: string,
  signMessage: SignMessageFn,
): Promise<Record<string, string>> {
  const existing = pendingAuth.get(address)
  if (existing) return existing

  const promise = _getAuthHeaders(address, signMessage).finally(() => {
    pendingAuth.delete(address)
  })
  pendingAuth.set(address, promise)
  return promise
}

async function _getAuthHeaders(
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

// --- Merchant report data (auth-protected) ---

export async function fetchMerchantReportData(
  address: string,
  chainId: number,
  period: string,
  signMessage: SignMessageFn,
): Promise<unknown> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)

  const url = new URL(`${baseUrl}/merchants/${encodeURIComponent(address)}/reports/${encodeURIComponent(period)}`)
  url.searchParams.set('chain_id', String(chainId))

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to fetch report data')
  }

  return res.json()
}

// --- CSV download ---

export async function downloadMerchantReportCsv(
  address: string,
  chainId: number,
  period: string,
  signMessage: SignMessageFn,
): Promise<void> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)

  const url = new URL(`${baseUrl}/merchants/${encodeURIComponent(address)}/reports/${encodeURIComponent(period)}/csv`)
  url.searchParams.set('chain_id', String(chainId))

  const res = await fetch(url.toString(), { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to download CSV')
  }

  const blob = await res.blob()
  const blobUrl = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = blobUrl
  a.download = `report-${address.toLowerCase()}-${period}.csv`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(blobUrl)
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

// --- Webhook config ---

export interface WebhookConfig {
  webhookUrl: string | null
  hasSecret: boolean
}

export interface WebhookSetupResponse {
  webhookUrl: string
  webhookSecret: string
  isNew: boolean
}

export async function getWebhookConfig(
  address: string,
  signMessage: SignMessageFn,
): Promise<WebhookConfig> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/webhook`, { headers })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to get webhook config')
  }
  return (await res.json()) as WebhookConfig
}

export async function setWebhookUrl(
  address: string,
  webhookUrl: string,
  signMessage: SignMessageFn,
): Promise<WebhookSetupResponse> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/webhook`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ webhookUrl }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to set webhook URL')
  }
  return (await res.json()) as WebhookSetupResponse
}

export async function deleteWebhook(
  address: string,
  signMessage: SignMessageFn,
): Promise<void> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/webhook`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to delete webhook')
  }
}

export async function rotateWebhookSecret(
  address: string,
  signMessage: SignMessageFn,
): Promise<{ webhookSecret: string }> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/webhook/rotate-secret`, {
    method: 'POST',
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to rotate webhook secret')
  }
  return (await res.json()) as { webhookSecret: string }
}

// --- Merchant API Keys ---

export interface MerchantApiKey {
  id: number
  keyPrefix: string
  label: string
  createdAt: string
  lastUsedAt: string | null
}

export interface CreateApiKeyResponse {
  key: string
  id: number
  keyPrefix: string
  label: string
  createdAt: string
}

export async function createMerchantApiKey(
  address: string,
  label: string,
  signMessage: SignMessageFn,
): Promise<CreateApiKeyResponse> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ label }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to create API key')
  }
  return (await res.json()) as CreateApiKeyResponse
}

export async function listMerchantApiKeys(
  address: string,
  signMessage: SignMessageFn,
): Promise<MerchantApiKey[]> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/api-keys`, {
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to list API keys')
  }
  const data = (await res.json()) as { keys: MerchantApiKey[] }
  return data.keys
}

export async function revokeMerchantApiKey(
  address: string,
  keyId: number,
  signMessage: SignMessageFn,
): Promise<void> {
  const { baseUrl } = resolveRelayer(address)
  const headers = await getAuthHeaders(address, signMessage)
  const res = await fetch(`${baseUrl}/merchants/${encodeURIComponent(address)}/api-keys/${keyId}`, {
    method: 'DELETE',
    headers,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error || 'Failed to revoke API key')
  }
}

// ── Points API ───────────────────────────────────────────────

export interface PointsLeaderboardEntry {
  wallet: string
  points: number
  total_usdc_volume: number
  tier: string
  current_streak: number
  rank: number
}

export interface PointsLeaderboardResponse {
  leaderboard: PointsLeaderboardEntry[]
  pagination: { page: number; limit: number; total: number; total_pages: number }
  period: string
}

export interface PointsBalanceResponse {
  wallet: string
  total_points: number
  total_usdc_volume: number
  monthly_points: number
  weekly_points: number
  rank: { all_time: number; monthly: number; weekly: number }
  tier: string
  current_streak: number
  longest_streak: number
  leaderboard_eligible: boolean
  recent_events: PointsHistoryEvent[]
}

export interface PointsHistoryEvent {
  id: number
  action_id: string
  display_name: string
  points: number
  usdc_amount: number | null
  category: string
  source_type: string
  source_ref: string
  created_at: string
}

export interface PointsActionDef {
  action_id: string
  display_name: string
  description: string
  points: number | null
  points_per_usdc: number | null
  category: string
  frequency: string
  source_type: string
}

export async function fetchPointsLeaderboard(
  period: 'all' | 'monthly' | 'weekly' = 'all',
  page = 1,
  limit = 50
): Promise<PointsLeaderboardResponse> {
  const url = new URL(`${RELAYER_URL}/points/leaderboard`)
  url.searchParams.set('period', period)
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to fetch leaderboard')
  return res.json()
}

export async function fetchPointsBalance(address: string): Promise<PointsBalanceResponse> {
  const res = await fetch(`${RELAYER_URL}/points/${address}`)
  if (!res.ok) throw new Error('Failed to fetch points balance')
  return res.json()
}

export async function fetchPointsHistory(
  address: string,
  page = 1,
  limit = 20
): Promise<{ events: PointsHistoryEvent[]; pagination: { page: number; limit: number; total: number; total_pages: number } }> {
  const url = new URL(`${RELAYER_URL}/points/${address}/history`)
  url.searchParams.set('page', String(page))
  url.searchParams.set('limit', String(limit))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to fetch points history')
  return res.json()
}

export async function fetchPointsActions(): Promise<{ actions: PointsActionDef[]; tiers: { name: string; threshold: number; color: string }[] }> {
  const res = await fetch(`${RELAYER_URL}/points/actions`)
  if (!res.ok) throw new Error('Failed to fetch points actions')
  return res.json()
}

export async function fetchReferralInfo(address: string) {
  const res = await fetch(`${RELAYER_URL}/points/referral/${address}`)
  if (!res.ok) throw new Error('Failed to fetch referral info')
  return res.json()
}

export async function trackPointsAction(
  actionId: string,
  wallet: string,
  signMessage: (args: { message: string }) => Promise<`0x${string}`>
): Promise<{ success: boolean; points_awarded?: number; total_points?: number; error?: string }> {
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `AutoPay Points\nAction: ${actionId}\nWallet: ${wallet.toLowerCase()}\nTimestamp: ${timestamp}`

  const signature = await signMessage({ message })

  const res = await fetch(`${RELAYER_URL}/points/track`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action_id: actionId,
      wallet: wallet.toLowerCase(),
      signature,
      timestamp,
    }),
  })

  return res.json()
}

export async function registerReferral(
  referralCode: string,
  referredWallet: string,
  signMessage: (args: { message: string }) => Promise<`0x${string}`>
): Promise<{ success: boolean; error?: string }> {
  const timestamp = Math.floor(Date.now() / 1000)
  const message = `AutoPay Referral\nCode: ${referralCode}\nWallet: ${referredWallet.toLowerCase()}\nTimestamp: ${timestamp}`

  const signature = await signMessage({ message })

  const res = await fetch(`${RELAYER_URL}/points/referral/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      referral_code: referralCode,
      referred_wallet: referredWallet.toLowerCase(),
      signature,
      timestamp,
    }),
  })

  return res.json()
}

// ── Payments API ─────────────────────────────────────────────

export interface PaymentRecord {
  id: number
  chainId: number
  from: string
  to: string
  amount: string
  txHash: string
  blockNumber: number | null
  note: string | null
  createdAt: string
}

/** Fire-and-forget: track a one-time USDC send on the relayer */
export function trackPayment(params: {
  chainId: number
  from: string
  to: string
  amount: string
  txHash: string
  blockNumber?: number
}) {
  if (!RELAYER_URL) return
  fetch(`${RELAYER_URL}/payments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  }).catch(() => {})
}

/** Fetch payment history for an address */
export async function getPayments(address: string, limit = 50, offset = 0): Promise<{ payments: PaymentRecord[]; total: number }> {
  const url = new URL(`${RELAYER_URL}/payments`)
  url.searchParams.set('address', address)
  url.searchParams.set('limit', String(limit))
  url.searchParams.set('offset', String(offset))
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error('Failed to fetch payments')
  return res.json()
}

// --- Whitelist (minimum charge bypass) ---

/** Default minimum subscription charge in USDC */
export const MIN_CHARGE_AMOUNT = 10

/** Check if an address is whitelisted (can bypass $10 minimum) */
export async function checkWhitelist(address: string): Promise<{ whitelisted: boolean; minAmount: number }> {
  const { baseUrl } = resolveRelayer(address)
  try {
    const res = await fetch(`${baseUrl}/whitelist/${address.toLowerCase()}`)
    if (!res.ok) return { whitelisted: false, minAmount: MIN_CHARGE_AMOUNT }
    return res.json()
  } catch {
    return { whitelisted: false, minAmount: MIN_CHARGE_AMOUNT }
  }
}

// --- Email verification (via relayer + Resend) ---

/** Send a 6-digit verification code to an email address */
export async function sendEmailCode(email: string): Promise<{ error: string | null }> {
  const baseUrl = import.meta.env.VITE_RELAYER_URL || ''
  if (!baseUrl) return { error: 'Relayer not configured' }
  try {
    const res = await fetch(`${baseUrl}/auth/send-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Failed to send code' }))
      return { error: data.error || 'Failed to send code' }
    }
    return { error: null }
  } catch {
    return { error: 'Could not reach server' }
  }
}

/** Verify a 6-digit code */
export async function verifyEmailCode(email: string, code: string): Promise<{ error: string | null }> {
  const baseUrl = import.meta.env.VITE_RELAYER_URL || ''
  if (!baseUrl) return { error: 'Relayer not configured' }
  try {
    const res = await fetch(`${baseUrl}/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, code }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: 'Verification failed' }))
      return { error: data.error || 'Verification failed' }
    }
    return { error: null }
  } catch {
    return { error: 'Could not reach server' }
  }
}

// --- Merchant account registration ---

/** Check if a merchant wallet has a registered account */
export async function checkMerchantAccount(address: string): Promise<{ registered: boolean }> {
  const { baseUrl } = resolveRelayer(address)
  const res = await fetch(`${baseUrl}/merchants/${address.toLowerCase()}/account`)
  if (!res.ok) throw new Error('Failed to check merchant account')
  return res.json()
}

/** Register a merchant account (link email to wallet via wallet signature) */
export async function registerMerchantAccount(
  address: string,
  email: string,
  signMessage: SignMessageFn
): Promise<{ registered: boolean; email: string }> {
  const { baseUrl } = resolveRelayer(address)
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }

  const authHeaders = await getAuthHeaders(address, signMessage)
  Object.assign(headers, authHeaders)

  const res = await fetch(`${baseUrl}/merchants/${address.toLowerCase()}/account`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Registration failed' }))
    throw new Error(err.error || 'Registration failed')
  }
  return res.json()
}
