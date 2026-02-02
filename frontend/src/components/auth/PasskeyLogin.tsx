import * as React from 'react'
import { useAuth } from '../../hooks'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Fingerprint, ArrowRight, AlertCircle, X } from 'lucide-react'

export function PasskeyLogin() {
  const { register, login, authError, clearAuthError } = useAuth()
  const [username, setUsername] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)

  const handleRegister = async () => {
    if (!username.trim()) return
    setIsLoading(true)
    await register(username.trim())
    setIsLoading(false)
  }

  const handleLogin = async () => {
    setIsLoading(true)
    await login()
    setIsLoading(false)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && username.trim()) handleRegister()
  }

  return (
    <div className="auth-passkey-layout">
      {/* Error message */}
      {authError && (
        <div className="flex items-start gap-3 rounded-xl p-3.5 bg-red-500/10 border border-red-500/20">
          <AlertCircle className="h-4 w-4 text-red-400 mt-0.5 flex-shrink-0" />
          <p className="flex-1 text-[13px] text-red-300 leading-relaxed">{authError}</p>
          <button
            onClick={clearAuthError}
            className="text-red-400/60 hover:text-red-300 flex-shrink-0"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* returning user — primary CTA */}
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="group w-full flex items-center gap-3.5 rounded-xl p-3.5 cursor-pointer
          bg-[hsl(221,83%,53%/0.08)] border border-[hsl(221,83%,53%/0.18)]
          hover:bg-[hsl(221,83%,53%/0.14)] hover:border-[hsl(221,83%,53%/0.30)]
          active:scale-[0.98]
          transition-all duration-200 disabled:opacity-50 disabled:pointer-events-none"
      >
        <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-[hsl(221,83%,53%/0.14)]">
          <Fingerprint className="h-5 w-5 text-[hsl(221,83%,68%)]" />
        </div>
        <div className="flex-1 text-left">
          <span className="block text-[14px] font-semibold text-white">
            Sign in with passkey
          </span>
          <span className="block text-[12px] text-[hsl(220,15%,50%)] mt-0.5">
            Face ID, Touch ID, or security key
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-[hsl(220,15%,35%)] group-hover:text-[hsl(221,83%,68%)] group-hover:translate-x-0.5 transition-all duration-200" />
      </button>

      {/* divider */}
      <div className="flex items-center gap-4">
        <div className="flex-1 h-px bg-[hsl(220,20%,15%)]" />
        <span className="text-[10px] font-medium text-[hsl(220,15%,28%)] tracking-[0.04em]">
          or
        </span>
        <div className="flex-1 h-px bg-[hsl(220,20%,15%)]" />
      </div>

      {/* registration */}
      <div className="rounded-xl p-4 bg-[hsl(228,22%,10%)] border border-[hsl(220,18%,17%)]">
        <p className="text-[12px] text-[hsl(220,15%,48%)] mb-3 font-medium">
          New here? Create an account to get started
        </p>
        <div className="flex gap-2">
          <Input
            value={username}
            onChange={(e) => { setUsername(e.target.value); clearAuthError() }}
            onKeyDown={handleKeyDown}
            placeholder="Choose a username"
            className="flex-1 h-11"
          />
          <Button
            onClick={handleRegister}
            disabled={!username.trim() || isLoading}
            className="h-11 px-5"
          >
            Register
          </Button>
        </div>
      </div>
    </div>
  )
}
