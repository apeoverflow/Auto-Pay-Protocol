import * as React from 'react'
import { Fingerprint, LogIn, AlertCircle } from 'lucide-react'
import { useAuth } from '../../hooks'

interface AuthStepProps {
  cancelUrl: string
}

export function AuthStep({ cancelUrl }: AuthStepProps) {
  const { register, login, authError, clearAuthError } = useAuth()
  const [mode, setMode] = React.useState<'choose' | 'register'>('choose')
  const [name, setName] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setIsSubmitting(true)
    try {
      await register(name.trim())
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleLogin = async () => {
    setIsSubmitting(true)
    try {
      await login()
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Fingerprint className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-lg font-semibold">Sign in to continue</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Use a passkey to securely create your wallet
        </p>
      </div>

      {authError && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 border border-red-100 text-sm text-red-600 mb-4">
          <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <div>
            <p>{authError}</p>
            <button onClick={clearAuthError} className="text-xs underline mt-1">Dismiss</button>
          </div>
        </div>
      )}

      {mode === 'choose' ? (
        <div className="space-y-3">
          <button
            onClick={() => setMode('register')}
            disabled={isSubmitting}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Fingerprint className="w-4 h-4" />
            Create new account
          </button>
          <button
            onClick={handleLogin}
            disabled={isSubmitting}
            className="w-full h-12 rounded-xl border border-border bg-card font-semibold text-sm hover:bg-muted/50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <LogIn className="w-4 h-4" />
            {isSubmitting ? 'Signing in...' : 'Sign in with existing passkey'}
          </button>
        </div>
      ) : (
        <form onSubmit={handleRegister} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">
              Choose a username
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. alice"
              autoFocus
              className="w-full h-11 px-4 rounded-xl border border-border bg-card text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
            />
          </div>
          <button
            type="submit"
            disabled={!name.trim() || isSubmitting}
            className="w-full h-12 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Fingerprint className="w-4 h-4" />
            {isSubmitting ? 'Creating...' : 'Create account'}
          </button>
          <button
            type="button"
            onClick={() => { setMode('choose'); clearAuthError() }}
            className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Back
          </button>
        </form>
      )}

      <div className="text-center mt-4">
        <a href={cancelUrl} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </a>
      </div>
    </div>
  )
}
