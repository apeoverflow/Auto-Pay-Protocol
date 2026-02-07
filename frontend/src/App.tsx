import { Component, type ReactNode, useCallback, useRef, useState } from 'react'
import { useAuth, useWallet, useRoute } from './hooks'
import type { Route } from './hooks/useRoute'
import { getRouteLayout, navItemToRoute, routeToNavItem, isDashboardRoute } from './hooks/useRoute'
import type { NavItem } from './components/layout/Sidebar'
import { isConfigured } from './config'
import { AuthScreen } from './components/auth'
import { DashboardLayout } from './components/layout'
import {
  DashboardPage,
  SubscriptionsPage,
  ActivityPage,
  SettingsPage,
  DemoPage,
  BridgePage,
  DocsPage,
  CheckoutPage,
} from './pages'
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

  // Redirect logged-in users from / to /dashboard
  const effectiveRoute = route === '/' && isLoggedIn ? '/dashboard' : route

  // Animated navigation between routes
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

  // Handle sidebar navigation: maps NavItem to Route
  const handleSidebarNavigate = useCallback(
    (item: NavItem) => {
      const targetRoute = navItemToRoute(item)
      const layout = getRouteLayout(targetRoute)

      if (layout === 'fullscreen') {
        // Docs gets animated transition
        animatedNavigate(targetRoute)
      } else {
        // Dashboard-to-dashboard: direct navigate (no animation)
        navigate(targetRoute)
        setDisplayedRoute(targetRoute)
      }
    },
    [animatedNavigate, navigate],
  )

  // Sync displayedRoute when route changes via popstate (back/forward)
  if (route !== displayedRoute && phase === 'idle') {
    // Only sync if not mid-animation
    const r = route === '/' && isLoggedIn ? '/dashboard' : route
    if (r !== displayedRoute) {
      setDisplayedRoute(r)
    }
  }

  // Derive animation classes for docs transitions
  const exitClass =
    phase === 'exiting'
      ? getRouteLayout(displayedRoute) !== 'fullscreen' && getRouteLayout(pendingRoute.current ?? displayedRoute) === 'fullscreen'
        ? 'route-exit-to-docs'
        : getRouteLayout(displayedRoute) === 'fullscreen'
          ? 'route-docs-exit'
          : 'route-fade-out'
      : ''

  const enterClass =
    phase === 'entering'
      ? getRouteLayout(displayedRoute) === 'fullscreen'
        ? 'route-docs-enter'
        : 'route-auth-enter'
      : ''

  const animClass = exitClass || enterClass

  // Use effectiveRoute for initial render, displayedRoute during animations
  const activeRoute = phase === 'idle' ? (effectiveRoute as Route) : displayedRoute

  // ── Fullscreen: Docs ──
  if (activeRoute === '/docs') {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <div
          className={`route-layer ${animClass}`}
          onAnimationEnd={onAnimationEnd}
        >
          <div className="flex h-screen flex-col bg-background overflow-hidden">
            <header className="flex h-14 flex-shrink-0 items-center gap-3 border-b border-border/50 bg-white/80 backdrop-blur-sm px-4">
              <button
                onClick={() => animatedNavigate(isLoggedIn ? '/dashboard' : '/')}
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

  // ── Fullscreen: Checkout ──
  if (activeRoute === '/checkout') {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <div className="route-layer">
          <CheckoutPage />
        </div>
      </div>
    )
  }

  // ── Auth screen (/ route, not logged in) ──
  if (activeRoute === '/' || !isLoggedIn) {
    const content = (() => {
      if (!isConfigured) return <NotConfiguredView />
      return <AuthScreen onNavigateDocs={() => animatedNavigate('/docs')} />
    })()

    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <div
          className={`route-layer ${animClass}`}
          onAnimationEnd={onAnimationEnd}
        >
          {content}
        </div>
      </div>
    )
  }

  // ── Dashboard routes (requires auth + wallet) ──
  if (isLoading || !account) {
    return (
      <div className="relative h-screen w-screen overflow-hidden">
        <div className="route-layer">
          <LoadingView />
        </div>
      </div>
    )
  }

  const currentNavItem = routeToNavItem(activeRoute)

  const renderPage = () => {
    switch (activeRoute) {
      case '/subscriptions':
        return <SubscriptionsPage />
      case '/activity':
        return <ActivityPage />
      case '/bridge':
        return <BridgePage />
      case '/settings':
        return <SettingsPage />
      case '/demo':
        return <DemoPage onNavigate={handleSidebarNavigate} />
      case '/dashboard':
      default:
        return <DashboardPage onNavigate={(page) => handleSidebarNavigate(page)} />
    }
  }

  return (
    <div className="relative h-screen w-screen overflow-hidden">
      <div
        className={`route-layer ${animClass}`}
        onAnimationEnd={onAnimationEnd}
      >
        <DashboardLayout currentPage={currentNavItem} onNavigate={handleSidebarNavigate}>
          {renderPage()}
        </DashboardLayout>
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
