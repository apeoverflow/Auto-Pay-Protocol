import * as React from 'react'
import { DashboardLayout, type NavItem } from '../layout'
import {
  DashboardPage,
  SubscriptionsPage,
  ActivityPage,
  SettingsPage,
  DemoPage,
  BridgePage,
} from '../../pages'

export function WalletDashboard({ onNavigateDocs }: { onNavigateDocs?: () => void }) {
  const [currentPage, setCurrentPage] = React.useState<NavItem>('dashboard')

  const handleNavigate = React.useCallback(
    (page: NavItem) => {
      if (page === 'docs') {
        onNavigateDocs?.()
        return
      }
      setCurrentPage(page)
    },
    [onNavigateDocs],
  )

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={handleNavigate} />
      case 'subscriptions':
        return <SubscriptionsPage />
      case 'activity':
        return <ActivityPage />
      case 'bridge':
        return <BridgePage />
      case 'demo':
        return <DemoPage onNavigate={handleNavigate} />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage onNavigate={handleNavigate} />
    }
  }

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={handleNavigate}>
      {renderPage()}
    </DashboardLayout>
  )
}
