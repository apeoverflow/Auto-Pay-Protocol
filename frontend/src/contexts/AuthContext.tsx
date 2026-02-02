import * as React from 'react'
import {
  WebAuthnMode,
  toWebAuthnCredential,
} from '@circle-fin/modular-wallets-core'
import type { P256Credential } from 'viem/account-abstraction'
import { passkeyTransport } from '../lib/clients'
import { STORAGE_KEYS } from '../config'

interface AuthContextValue {
  credential: P256Credential | null
  username: string | undefined
  isLoggedIn: boolean
  authError: string | null
  clearAuthError: () => void
  register: (username: string) => Promise<void>
  login: () => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [credential, setCredential] = React.useState<P256Credential | null>(() =>
    JSON.parse(localStorage.getItem(STORAGE_KEYS.CREDENTIAL) || 'null')
  )
  const [username, setUsername] = React.useState<string | undefined>(
    () => localStorage.getItem(STORAGE_KEYS.USERNAME) || undefined
  )

  const [authError, setAuthError] = React.useState<string | null>(null)

  const clearAuthError = React.useCallback(() => setAuthError(null), [])

  const isLoggedIn = credential !== null

  function parseAuthError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error)

    if (/username.*(duplicat|taken|exists)/i.test(message))
      return 'This username is already taken. Please choose a different one or sign in.'
    if (/cancel/i.test(message))
      return 'Authentication was cancelled. Please try again.'
    if (/not allowed|NotAllowedError/i.test(message))
      return 'Authentication request was denied. Please try again.'
    if (/timeout/i.test(message))
      return 'Authentication timed out. Please try again.'
    if (/network|fetch/i.test(message))
      return 'Network error. Please check your connection and try again.'

    return message || 'Something went wrong. Please try again.'
  }

  const register = React.useCallback(async (name: string) => {
    if (!passkeyTransport || !name) return
    setAuthError(null)

    try {
      const newCredential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Register,
        username: name,
      })

      localStorage.setItem(STORAGE_KEYS.CREDENTIAL, JSON.stringify(newCredential))
      localStorage.setItem(STORAGE_KEYS.USERNAME, name)

      setCredential(newCredential)
      setUsername(name)
    } catch (error) {
      setAuthError(parseAuthError(error))
    }
  }, [])

  const login = React.useCallback(async () => {
    if (!passkeyTransport) return
    setAuthError(null)

    try {
      const newCredential = await toWebAuthnCredential({
        transport: passkeyTransport,
        mode: WebAuthnMode.Login,
      })

      localStorage.setItem(STORAGE_KEYS.CREDENTIAL, JSON.stringify(newCredential))

      setCredential(newCredential)
    } catch (error) {
      setAuthError(parseAuthError(error))
    }
  }, [])

  const logout = React.useCallback(() => {
    localStorage.removeItem(STORAGE_KEYS.CREDENTIAL)
    localStorage.removeItem(STORAGE_KEYS.USERNAME)

    setCredential(null)
    setUsername(undefined)
  }, [])

  const value = React.useMemo(
    () => ({
      credential,
      username,
      isLoggedIn,
      authError,
      clearAuthError,
      register,
      login,
      logout,
    }),
    [credential, username, isLoggedIn, authError, clearAuthError, register, login, logout]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
