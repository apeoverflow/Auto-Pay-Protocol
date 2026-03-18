import { useEffect } from 'react'
import type { Route } from '../hooks/useRoute'

const ROUTE_TITLES: Partial<Record<Route, string>> = {
  '/': 'AutoPayProtocol — Non-Custodial Crypto Subscriptions',
  '/docs': 'Documentation — AutoPayProtocol',
  '/checkout': 'Checkout — AutoPayProtocol',
  '/pay': 'Subscribe — AutoPayProtocol',
  '/terms': 'Terms of Service — AutoPayProtocol',
  '/privacy': 'Privacy Policy — AutoPayProtocol',
  '/dashboard': 'Dashboard — AutoPayProtocol',
  '/subscriptions': 'Subscriptions — AutoPayProtocol',
  '/activity': 'Activity — AutoPayProtocol',
  '/bridge': 'Bridge — AutoPayProtocol',
  '/settings': 'Settings — AutoPayProtocol',
  '/merchant': 'Merchant Dashboard — AutoPayProtocol',
  '/merchant/plans': 'Plans — AutoPayProtocol',
  '/merchant/subscribers': 'Subscribers — AutoPayProtocol',
  '/merchant/receipts': 'Receipts — AutoPayProtocol',
  '/merchant/reports': 'Reports — AutoPayProtocol',
  '/merchant/settings': 'Merchant Settings — AutoPayProtocol',
}

interface SEOHeadProps {
  route: Route
  /** Override the title — used for dynamic pages like checkout */
  title?: string
}

/**
 * Sets document.title on client-side navigation.
 * Server-side meta tags (OG, Twitter, description) are handled by api/ssr.ts.
 */
export function SEOHead({ route, title }: SEOHeadProps) {
  const pageTitle = title ?? ROUTE_TITLES[route] ?? 'AutoPayProtocol'

  useEffect(() => {
    document.title = pageTitle
  }, [pageTitle])

  return null
}
