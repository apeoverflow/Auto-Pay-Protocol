import { createClient } from '@supabase/supabase-js'

// Supabase configuration from environment
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Create Supabase client (singleton)
export const supabase = supabaseUrl && supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Check if Supabase is configured
export const isSupabaseConfigured = (): boolean => {
  return supabase !== null
}

// --- Supabase Auth helpers (email verification code via Confirm signup template) ---

export async function sendEmailCode(email: string): Promise<{ error: string | null }> {
  if (!supabase) return { error: 'Supabase not configured' }

  // Try signUp first (sends Confirm signup email with {{ .Token }})
  const { data, error } = await supabase.auth.signUp({
    email,
    password: crypto.randomUUID(),
  })

  // If user already exists (identities array is empty), resend the confirmation
  if (!error && data.user && data.user.identities?.length === 0) {
    const { error: resendError } = await supabase.auth.resend({
      email,
      type: 'signup',
    })
    return { error: resendError?.message ?? null }
  }

  return { error: error?.message ?? null }
}

export async function verifyOtp(email: string, token: string): Promise<{ error: string | null; userId: string | null }> {
  if (!supabase) return { error: 'Supabase not configured', userId: null }

  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'signup',
  })

  return { error: error?.message ?? null, userId: data.user?.id ?? null }
}

export async function getAuthUser() {
  if (!supabase) return null
  const { data } = await supabase.auth.getUser()
  return data.user
}

export async function signOut() {
  if (!supabase) return
  await supabase.auth.signOut()
}

export function onAuthStateChange(callback: (event: string, session: unknown) => void) {
  if (!supabase) return { data: { subscription: { unsubscribe: () => {} } } }
  return supabase.auth.onAuthStateChange(callback)
}

// Database types matching the relayer schema
export interface DbPolicy {
  id: string
  chain_id: number
  payer: string
  merchant: string
  charge_amount: string
  spending_cap: string
  total_spent: string
  interval_seconds: number
  last_charged_at: string | null
  next_charge_at: string
  charge_count: number
  active: boolean
  metadata_url: string | null
  created_at: string
  ended_at: string | null
  created_block: number
  created_tx: string
  cancelled_by_failure: boolean | null
  cancelled_at: string | null
}

export interface DbCharge {
  id: number
  policy_id: string
  chain_id: number
  tx_hash: string | null
  status: 'pending' | 'success' | 'failed'
  amount: string
  protocol_fee: string | null
  receipt_cid: string | null
  error_message: string | null
  attempt_count: number
  created_at: string
  completed_at: string | null
}

// Fetch policies for a payer from Supabase
export async function fetchPoliciesFromDb(
  payerAddress: string,
  chainId: number
): Promise<DbPolicy[] | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .eq('payer', payerAddress.toLowerCase())
      .eq('chain_id', chainId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Supabase fetch policies error:', error)
      return null
    }

    return data as DbPolicy[]
  } catch (err) {
    console.warn('Failed to fetch policies from Supabase:', err)
    return null
  }
}

// Fetch charges for a payer from Supabase (via policies join)
export async function fetchChargesFromDb(
  payerAddress: string,
  chainId: number
): Promise<(DbCharge & { policy: DbPolicy })[] | null> {
  if (!supabase) return null

  try {
    // First get the payer's policies
    const { data: policies, error: policiesError } = await supabase
      .from('policies')
      .select('id')
      .eq('payer', payerAddress.toLowerCase())
      .eq('chain_id', chainId)

    if (policiesError || !policies?.length) {
      return []
    }

    const policyIds = policies.map(p => p.id)

    // Then get charges for those policies
    const { data: charges, error: chargesError } = await supabase
      .from('charges')
      .select(`
        *,
        policy:policies(*)
      `)
      .in('policy_id', policyIds)
      .eq('chain_id', chainId)
      .order('created_at', { ascending: false })

    if (chargesError) {
      console.warn('Supabase fetch charges error:', chargesError)
      return null
    }

    return charges as (DbCharge & { policy: DbPolicy })[]
  } catch (err) {
    console.warn('Failed to fetch charges from Supabase:', err)
    return null
  }
}

// Fetch policies for a merchant from Supabase
export async function fetchMerchantPolicies(
  merchantAddress: string,
  chainId: number
): Promise<DbPolicy[] | null> {
  if (!supabase) return null

  try {
    const { data, error } = await supabase
      .from('policies')
      .select('*')
      .eq('merchant', merchantAddress.toLowerCase())
      .eq('chain_id', chainId)
      .order('created_at', { ascending: false })

    if (error) {
      console.warn('Supabase fetch merchant policies error:', error)
      return null
    }

    return data as DbPolicy[]
  } catch (err) {
    console.warn('Failed to fetch merchant policies from Supabase:', err)
    return null
  }
}

// Fetch charge stats for a merchant from Supabase
export async function fetchMerchantChargeStats(
  merchantAddress: string,
  chainId: number
): Promise<{ totalRevenue: string; chargeCount: number } | null> {
  if (!supabase) return null

  try {
    // Get merchant's policy IDs
    const { data: policies, error: policiesError } = await supabase
      .from('policies')
      .select('id')
      .eq('merchant', merchantAddress.toLowerCase())
      .eq('chain_id', chainId)

    if (policiesError || !policies?.length) {
      return { totalRevenue: '0', chargeCount: 0 }
    }

    const policyIds = policies.map(p => p.id)

    // Sum successful charges
    const { data: charges, error: chargesError } = await supabase
      .from('charges')
      .select('amount')
      .in('policy_id', policyIds)
      .eq('chain_id', chainId)
      .eq('status', 'success')

    if (chargesError) {
      console.warn('Supabase fetch merchant charges error:', chargesError)
      return null
    }

    const totalRevenue = (charges || []).reduce(
      (sum, c) => sum + parseFloat(c.amount || '0'),
      0
    ).toString()

    return { totalRevenue, chargeCount: charges?.length || 0 }
  } catch (err) {
    console.warn('Failed to fetch merchant charge stats from Supabase:', err)
    return null
  }
}

// Fetch activity (policies + charges) for a payer
export async function fetchActivityFromDb(
  payerAddress: string,
  chainId: number
): Promise<{
  policies: DbPolicy[]
  charges: DbCharge[]
} | null> {
  if (!supabase) return null

  try {
    // Fetch policies
    const { data: policies, error: policiesError } = await supabase
      .from('policies')
      .select('*')
      .eq('payer', payerAddress.toLowerCase())
      .eq('chain_id', chainId)
      .order('created_at', { ascending: false })

    if (policiesError) {
      console.warn('Supabase fetch policies error:', policiesError)
      return null
    }

    if (!policies?.length) {
      return { policies: [], charges: [] }
    }

    const policyIds = policies.map(p => p.id)

    // Fetch charges for these policies
    const { data: charges, error: chargesError } = await supabase
      .from('charges')
      .select('*')
      .in('policy_id', policyIds)
      .eq('chain_id', chainId)
      .eq('status', 'success')
      .order('created_at', { ascending: false })

    if (chargesError) {
      console.warn('Supabase fetch charges error:', chargesError)
      return null
    }

    return {
      policies: policies as DbPolicy[],
      charges: (charges || []) as DbCharge[],
    }
  } catch (err) {
    console.warn('Failed to fetch activity from Supabase:', err)
    return null
  }
}
