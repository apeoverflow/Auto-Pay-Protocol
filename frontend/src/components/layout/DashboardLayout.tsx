import * as React from 'react'
import { Sidebar, type NavItem } from './Sidebar'
import { Header } from './Header'
import { PointsPage } from '../../pages/PointsPage'
import { X } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
  currentPage: NavItem
  onNavigate: (page: NavItem) => void
}

export function DashboardLayout({ children, currentPage, onNavigate }: DashboardLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(false)
  const [pointsOpen, setPointsOpen] = React.useState(false)

  // Auto-open points modal if landing page set the flag
  React.useEffect(() => {
    const check = () => {
      if (sessionStorage.getItem('open_points')) {
        sessionStorage.removeItem('open_points')
        setPointsOpen(true)
      }
    }
    check()
    // Re-check on visibility change (covers wallet connect popup returning focus)
    document.addEventListener('visibilitychange', check)
    return () => document.removeEventListener('visibilitychange', check)
  }, [currentPage])

  const handleNavigate = (page: NavItem) => {
    if (page === 'points') {
      setPointsOpen(true)
      setSidebarOpen(false)
      return
    }
    onNavigate(page)
    setSidebarOpen(false)
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
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
        <Header currentPage={currentPage} onMenuToggle={() => setSidebarOpen(true)} onNavigate={handleNavigate} />
        <main className="flex-1 overflow-auto px-3 py-3 lg:p-6 min-w-0 bg-background">
          {children}
        </main>
      </div>

      {/* Points Modal */}
      {pointsOpen && (
        <div className="fixed inset-0 z-50" onClick={() => setPointsOpen(false)}>
          {/* Backdrop — hidden on mobile (modal is full-screen) */}
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm hidden lg:block" />

          {/* Modal — full-screen on mobile, centered card on desktop */}
          <div className="hidden lg:flex fixed inset-0 items-center justify-center py-6 pr-6 pl-[232px] pointer-events-none">
            <div
              className="relative w-full max-w-[1100px] h-[90vh] bg-background rounded-2xl shadow-2xl border border-border/50 overflow-hidden flex flex-col pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-5 py-3 border-b border-border/50 shrink-0">
                <div className="flex items-center gap-2.5">
                  <img src="/logos/autopay-icon-white.svg" alt="" className="h-6 w-6 rounded-md" style={{ background: '#1D1D1F', padding: 2 }} />
                  <h2 className="text-base font-semibold tracking-tight" style={{ fontFamily: "'DM Sans', sans-serif" }}>Loyalty Points</h2>
                </div>
                <button onClick={() => setPointsOpen(false)} className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-5 lg:p-6">
                <PointsPage />
              </div>
            </div>
          </div>

          {/* Mobile — full screen sheet */}
          <div
            className="lg:hidden fixed inset-0 bg-background flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50 shrink-0 safe-top">
              <div className="flex items-center gap-2">
                <img src="/logos/autopay-icon-white.svg" alt="" className="h-5 w-5 rounded" style={{ background: '#1D1D1F', padding: 2 }} />
                <h2 className="text-sm font-semibold">Loyalty Points</h2>
              </div>
              <button onClick={() => setPointsOpen(false)} className="flex items-center justify-center h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-3 py-3 safe-bottom">
              <PointsPage />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
