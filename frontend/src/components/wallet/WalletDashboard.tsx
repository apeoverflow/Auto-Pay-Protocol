import * as React from 'react'
import { DashboardLayout, type NavItem } from '../layout'
import {
  DashboardPage,
  SubscriptionsPage,
  ActivityPage,
  SettingsPage,
  DemoPage,
  BridgePage,
  DocsPage,
} from '../../pages'

export function WalletDashboard() {
  const [currentPage, setCurrentPage] = React.useState<NavItem>('dashboard')

  const renderPage = () => {
    switch (currentPage) {
      case 'dashboard':
        return <DashboardPage onNavigate={setCurrentPage} />
      case 'subscriptions':
        return <SubscriptionsPage />
      case 'activity':
        return <ActivityPage />
      case 'bridge':
        return <BridgePage />
      case 'demo':
        return <DemoPage onNavigate={setCurrentPage} />
      case 'docs':
        return <DocsPage />
      case 'settings':
        return <SettingsPage />
      default:
        return <DashboardPage onNavigate={setCurrentPage} />
    }
  }

  return (
    <DashboardLayout currentPage={currentPage} onNavigate={setCurrentPage}>
      {renderPage()}
    </DashboardLayout>
  )
}
