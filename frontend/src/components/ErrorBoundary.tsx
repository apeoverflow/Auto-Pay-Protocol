import * as React from 'react'
import { CHAIN_STORAGE_KEY } from '../config/activeChain'
import { DEFAULT_CHAIN } from '../config/chains'

interface Props {
  children: React.ReactNode
}

interface State {
  error: Error | null
}

/**
 * Root error boundary. Catches render crashes (e.g. Privy's "Embedded wallet is
 * only available over HTTPS" when a Tempo/Arc chain is selected in a non-secure
 * context) so the app shows a recovery screen instead of a white page, and lets
 * the user reset back to the default chain.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('App crashed:', error, info)
  }

  handleReset = () => {
    try {
      window.localStorage.setItem(CHAIN_STORAGE_KEY, DEFAULT_CHAIN)
    } catch { /* ignore */ }
    window.location.reload()
  }

  render() {
    if (!this.state.error) return this.props.children

    const msg = this.state.error.message || 'Something went wrong.'
    const isHttps = typeof window !== 'undefined' && window.isSecureContext

    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 text-center shadow-lg">
          <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">{msg}</p>
          {!isHttps && /https/i.test(msg) && (
            <p className="mt-3 text-xs text-muted-foreground">
              Tempo and Arc wallets require a secure context. Open this app over{' '}
              <code className="rounded bg-muted px-1 py-0.5">https://</code> or{' '}
              <code className="rounded bg-muted px-1 py-0.5">localhost</code> to use them.
            </p>
          )}
          <button
            onClick={this.handleReset}
            className="mt-5 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reset to default chain
          </button>
        </div>
      </div>
    )
  }
}
