import * as React from 'react'
import { Sidebar, type NavItem } from './Sidebar'
import { Header } from './Header'

interface DashboardLayoutProps {
  children: React.ReactNode
  currentPage: NavItem
  onNavigate: (page: NavItem) => void
}

export function DashboardLayout({ children, currentPage, onNavigate }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  const handleNavigate = (page: NavItem) => {
    onNavigate(page)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        mobileOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Content */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Header currentPage={currentPage} onMenuToggle={() => setSidebarOpen(true)} />
        <main className="flex-1 overflow-auto px-3 py-3 md:p-6 min-w-0 bg-background">
          {children}
        </main>
      </div>
    </div>
  )
}
