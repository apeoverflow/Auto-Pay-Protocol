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
}

export interface DbCharge {
  id: number
  policy_id: string
  chain_id: number
  tx_hash: string | null
  status: 'pending' | 'success' | 'failed'
  amount: string
  protocol_fee: string | null
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
