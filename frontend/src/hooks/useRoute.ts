import { useState, useEffect, useCallback } from 'react'
import type { NavItem } from '../components/layout/Sidebar'
import { isBrowser } from '../lib/ssr'

export type Route =
  | '/'
  | '/app'
  | '/dashboard'
  | '/subscriptions'
  | '/activity'
  | '/bridge'
  | '/settings'
  | '/demo'
  | '/docs'
  | '/checkout'
  | '/merchant'
  | '/merchant/plans'
  | '/merchant/plans/new'
  | '/merchant/plans/edit'
  | '/merchant/receipts'
  | '/merchant/reports'
  | '/merchant/subscribers'
  | '/merchant/settings'
  | '/pay'
  | '/terms'
  | '/privacy'

type RouteLayout = 'landing' | 'auth' | 'dashboard' | 'fullscreen'

const DASHBOARD_ROUTES: Route[] = [
  '/dashboard', '/subscriptions', '/activity', '/bridge', '/settings', '/demo',
  '/merchant', '/merchant/plans', '/merchant/plans/new', '/merchant/plans/edit', '/merchant/receipts', '/merchant/reports', '/merchant/subscribers', '/merchant/settings',
]

const ROUTE_TO_NAV: Record<string, NavItem> = {
  '/dashboard': 'dashboard',
  '/subscriptions': 'subscriptions',
  '/activity': 'activity',
  '/bridge': 'bridge',
  '/settings': 'settings',
  '/demo': 'demo',
  '/docs': 'docs',
  '/merchant': 'merchant-overview',
  '/merchant/plans': 'merchant-plans',
  '/merchant/plans/new': 'merchant-plans',
  '/merchant/plans/edit': 'merchant-plans',
  '/merchant/receipts': 'merchant-receipts',
  '/merchant/reports': 'merchant-reports',
  '/merchant/subscribers': 'merchant-subscribers',
  '/merchant/settings': 'merchant-settings',
}

const NAV_TO_ROUTE: Record<NavItem, Route> = {
  dashboard: '/dashboard',
  subscriptions: '/subscriptions',
  activity: '/activity',
  bridge: '/bridge',
  settings: '/settings',
  demo: '/demo',
  docs: '/docs',
  'merchant-overview': '/merchant',
  'merchant-plans': '/merchant/plans',
  'merchant-receipts': '/merchant/receipts',
  'merchant-reports': '/merchant/reports',
  'merchant-subscribers': '/merchant/subscribers',
  'merchant-settings': '/merchant/settings',
}

const VALID_ROUTES: Route[] = [
  '/', '/app', '/dashboard', '/subscriptions', '/activity', '/bridge', '/settings', '/demo', '/docs', '/checkout', '/pay', '/terms', '/privacy',
  '/merchant', '/merchant/plans', '/merchant/plans/new', '/merchant/plans/edit', '/merchant/receipts', '/merchant/reports', '/merchant/subscribers', '/merchant/settings',
]

function pathToRoute(pathname: string): Route {
  // Strip trailing slash (but keep "/" as-is)
  const stripped = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const normalized = stripped === '' ? '/' : stripped
  // Match /pay/:shortId paths
  if (normalized.startsWith('/pay/')) return '/pay'
  return VALID_ROUTES.includes(normalized as Route) ? (normalized as Route) : '/'
}

export function getRouteLayout(route: Route): RouteLayout {
  if (route === '/') return 'landing'
  if (route === '/app') return 'auth'
  if (route === '/docs' || route === '/checkout' || route === '/pay' || route === '/terms' || route === '/privacy') return 'fullscreen'
  return 'dashboard'
}

export function routeToNavItem(route: Route): NavItem {
  return ROUTE_TO_NAV[route] ?? 'dashboard'
}

export function navItemToRoute(item: NavItem): Route {
  return NAV_TO_ROUTE[item] ?? '/dashboard'
}

export function isDashboardRoute(route: Route): boolean {
  return DASHBOARD_ROUTES.includes(route)
}

export function useRoute(serverUrl?: string) {
  const [route, setRoute] = useState<Route>(() => {
    if (serverUrl) return pathToRoute(serverUrl)
    return isBrowser ? pathToRoute(window.location.pathname) : '/'
  })

  const navigate = useCallback((to: Route, search?: string) => {
    if (!isBrowser) return
    const url = search ? `${to}${search}` : to
    window.history.pushState(null, '', url)
    setRoute(to)
  }, [])

  useEffect(() => {
    if (!isBrowser) return
    const onPopState = () => setRoute(pathToRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return { route, navigate }
}
