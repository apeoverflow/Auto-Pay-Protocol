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
        <div className="flex items-start gap-3 rounded-xl p-3.5 bg-red-50 border border-red-200">
          <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
          <p className="flex-1 text-[13px] text-red-600 leading-relaxed">{authError}</p>
          <button
            onClick={clearAuthError}
            className="text-red-400 hover:text-red-600 flex-shrink-0 rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-400/50"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* returning user — primary CTA */}
      <button
        onClick={handleLogin}
        disabled={isLoading}
        className="auth-passkey-btn group"
      >
        <div className="auth-passkey-btn-icon">
          <Fingerprint className="h-5 w-5 text-blue-600 auth-fingerprint-pulse" />
        </div>
        <div className="flex-1 text-left">
          <span className="block text-[14px] font-semibold text-gray-900">
            Sign in with passkey
          </span>
          <span className="block text-[12px] text-gray-500 mt-0.5">
            Face ID, Touch ID, or security key
          </span>
        </div>
        <ArrowRight className="h-4 w-4 text-gray-400 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all duration-200" />
      </button>

      {/* divider */}
      <div className="auth-divider">
        <span className="auth-divider-text">or</span>
      </div>

      {/* registration */}
      <div className="auth-register-box">
        <p className="text-[12px] text-gray-500 mb-3 font-medium">
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
            className="auth-register-btn"
          >
            Register
          </Button>
        </div>
      </div>
    </div>
  )
}
