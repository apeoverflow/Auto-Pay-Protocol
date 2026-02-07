import { useState, useEffect, useCallback } from 'react'
import type { NavItem } from '../components/layout/Sidebar'

export type Route =
  | '/'
  | '/dashboard'
  | '/subscriptions'
  | '/activity'
  | '/bridge'
  | '/settings'
  | '/demo'
  | '/docs'
  | '/checkout'

type RouteLayout = 'auth' | 'dashboard' | 'fullscreen'

const DASHBOARD_ROUTES: Route[] = ['/dashboard', '/subscriptions', '/activity', '/bridge', '/settings', '/demo']

const ROUTE_TO_NAV: Record<string, NavItem> = {
  '/dashboard': 'dashboard',
  '/subscriptions': 'subscriptions',
  '/activity': 'activity',
  '/bridge': 'bridge',
  '/settings': 'settings',
  '/demo': 'demo',
  '/docs': 'docs',
}

const NAV_TO_ROUTE: Record<NavItem, Route> = {
  dashboard: '/dashboard',
  subscriptions: '/subscriptions',
  activity: '/activity',
  bridge: '/bridge',
  settings: '/settings',
  demo: '/demo',
  docs: '/docs',
}

function pathToRoute(pathname: string): Route {
  // Strip trailing slash (but keep "/" as-is)
  const stripped = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  const normalized = stripped === '' ? '/' : stripped
  const valid: Route[] = ['/', '/dashboard', '/subscriptions', '/activity', '/bridge', '/settings', '/demo', '/docs', '/checkout']
  return valid.includes(normalized as Route) ? (normalized as Route) : '/'
}

export function getRouteLayout(route: Route): RouteLayout {
  if (route === '/') return 'auth'
  if (route === '/docs' || route === '/checkout') return 'fullscreen'
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

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => pathToRoute(window.location.pathname))

  const navigate = useCallback((to: Route, search?: string) => {
    const url = search ? `${to}${search}` : to
    window.history.pushState(null, '', url)
    setRoute(to)
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(pathToRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return { route, navigate }
}
