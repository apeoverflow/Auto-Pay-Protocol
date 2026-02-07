import { Component, type ReactNode, useState, useCallback, useRef } from 'react'
import { useAuth, useWallet, useRoute } from './hooks'
import type { Route } from './hooks/useRoute'
import { isConfigured } from './config'
import { AuthScreen } from './components/auth'
import { WalletDashboard } from './components/wallet'
import { DocsPage } from './pages'
import { NotConfiguredView, LoadingView } from './views'
import { ArrowLeft } from 'lucide-react'

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

type Phase = 'idle' | 'exiting' | 'entering'

function App() {
  const { isLoggedIn } = useAuth()
  const { account, isLoading } = useWallet()
  const { route, navigate } = useRoute()

  const [phase, setPhase] = useState<Phase>('idle')
  const [displayedRoute, setDisplayedRoute] = useState<Route>(route)
  const pendingRoute = useRef<Route | null>(null)

  const animatedNavigate = useCallback(
    (to: Route) => {
      if (phase !== 'idle' || to === displayedRoute) return
      pendingRoute.current = to
      setPhase('exiting')
    },
    [phase, displayedRoute],
  )

  const onAnimationEnd = useCallback(() => {
    if (phase === 'exiting' && pendingRoute.current) {
      navigate(pendingRoute.current)
      setDisplayedRoute(pendingRoute.current)
      pendingRoute.current = null
      setPhase('entering')
    } else if (phase === 'entering') {
      setPhase('idle')
    }
  }, [phase, navigate])

  const navigateToDocs = useCallback(() => animatedNavigate('/docs'), [animatedNavigate])
  const navigateHome = useCallback(() => animatedNavigate('/'), [animatedNavigate])

  // Derive animation classes
  const exitClass =
    phase === 'exiting'
      ? displayedRoute === '/'
        ? 'route-exit-to-docs'
        : 'route-docs-exit'
      : ''

  const enterClass =
    phase === 'entering'
      ? displayedRoute === '/docs'
        ? 'route-docs-enter'
        : 'route-auth-enter'
      : ''

  const animClass = exitClass || enterClass

  // Docs page — shown regardless of auth state
  if (displayedRoute === '/docs') {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <div
          className={`route-layer ${animClass}`}
          onAnimationEnd={onAnimationEnd}
        >
          <div className="flex h-screen flex-col bg-background overflow-hidden">
            <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border/50 bg-white/80 backdrop-blur-sm px-4">
              <button
                onClick={navigateHome}
                className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to {isLoggedIn ? 'Dashboard' : 'Sign In'}
              </button>
            </header>
            <div className="flex-1 min-h-0 overflow-hidden">
              <DocsPage />
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Home route — normal auth / dashboard flow
  const homeContent = (() => {
    if (!isConfigured) return <NotConfiguredView />
    if (!isLoggedIn) return <AuthScreen onNavigateDocs={navigateToDocs} />
    if (isLoading || !account) return <LoadingView />
    return <WalletDashboard onNavigateDocs={navigateToDocs} />
  })()

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div
        className={`route-layer ${animClass}`}
        onAnimationEnd={onAnimationEnd}
      >
        {homeContent}
      </div>
    </div>
  )
}

export default function AppWithErrorBoundary() {
  return (
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  )
}
