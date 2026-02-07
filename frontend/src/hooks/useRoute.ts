import { useState, useEffect, useCallback } from 'react'

export type Route = '/' | '/docs'

function pathToRoute(pathname: string): Route {
  return pathname === '/docs' ? '/docs' : '/'
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => pathToRoute(window.location.pathname))

  const navigate = useCallback((to: Route) => {
    window.history.pushState(null, '', to)
    setRoute(to)
  }, [])

  useEffect(() => {
    const onPopState = () => setRoute(pathToRoute(window.location.pathname))
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  return { route, navigate }
}
