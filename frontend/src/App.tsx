import { Component, type ReactNode } from 'react'
import { useAuth, useWallet } from './hooks'
import { isConfigured } from './config'
import { AuthScreen } from './components/auth'
import { WalletDashboard } from './components/wallet'
import { NotConfiguredView, LoadingView } from './views'

interface ErrorBoundaryState {
  hasError: boolean
}

class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-4">
          <div className="text-center space-y-4">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="text-muted-foreground">Please refresh the page to try again.</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              Refresh
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

function App() {
  const { isLoggedIn } = useAuth()
  const { account, isLoading } = useWallet()

  if (!isConfigured) {
    return <NotConfiguredView />
  }

  if (!isLoggedIn) {
    return <AuthScreen />
  }

  if (isLoading || !account) {
    return <LoadingView />
  }

  return <WalletDashboard />
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
