// Shared Supabase auth helper — included by all merchant pages
// Uses the anon key (safe for client-side)

const SUPABASE_URL = 'https://jlafnlrurqqalgvxshgz.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsYWZubHJ1cnFxYWxndnhzaGd6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyMjA4NjMsImV4cCI6MjA4NTc5Njg2M30.A8nBhad3PyMo4k7o2hh-C0pmvX7cXua7ISxK1H8RKac'

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

async function getSession() {
  const { data: { session } } = await sb.auth.getSession()
  return session
}

async function getAccessToken() {
  const session = await getSession()
  return session?.access_token || null
}

async function requireAuth() {
  const session = await getSession()
  if (!session) {
    window.location.href = '/login'
    return null
  }
  return session
}

async function handleLogout() {
  await sb.auth.signOut()
  window.location.href = '/login'
}
