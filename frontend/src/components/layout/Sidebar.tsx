import { cn } from '../../lib/utils'
import {
  LayoutDashboard,
  CreditCard,
  Activity,
  Settings,
  LogOut,
  X,
  Beaker,
} from 'lucide-react'
import { Button } from '../ui/button'
import { useAuth } from '../../hooks'

export type NavItem = 'dashboard' | 'subscriptions' | 'activity' | 'settings' | 'demo'

interface SidebarProps {
  currentPage: NavItem
  onNavigate: (page: NavItem) => void
  mobileOpen?: boolean
  onClose?: () => void
}

const navItems: { id: NavItem; label: string; icon: React.ReactNode }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'subscriptions', label: 'Subscriptions', icon: <CreditCard className="h-4 w-4" /> },
  { id: 'activity', label: 'Activity', icon: <Activity className="h-4 w-4" /> },
  { id: 'demo', label: 'SDK Demo', icon: <Beaker className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="h-4 w-4" /> },
]

export function Sidebar({ currentPage, onNavigate, mobileOpen = false, onClose }: SidebarProps) {
  const { logout } = useAuth()

  return (
    <>
      {/* Backdrop overlay for mobile */}
      <div
        className={cn(
          'fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm transition-opacity duration-300 md:hidden',
          mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-[60] flex w-[260px] md:w-[220px] flex-col sidebar-gradient flex-shrink-0 border-r border-white/[0.06] transition-transform duration-300 ease-in-out',
          'md:static md:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo / Brand */}
        <div className="flex h-16 items-center justify-between px-5">
          <img src="/logo.png" alt="AutoPayProtocol" className="h-9 w-auto opacity-90" />
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 md:hidden"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 space-y-1 px-3 pt-3">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200',
                currentPage === item.id
                  ? 'bg-white/[0.12] text-white shadow-sm backdrop-blur-sm'
                  : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
              )}
            >
              <span className={cn(
                'flex h-7 w-7 items-center justify-center rounded-lg transition-all duration-200',
                currentPage === item.id
                  ? 'bg-primary text-white shadow-md shadow-primary/30'
                  : 'text-current'
              )}>
                {item.icon}
              </span>
              {item.label}
            </button>
          ))}
        </nav>

        {/* Footer / Logout */}
        <div className="border-t border-white/[0.06] p-3">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-[13px] text-white/40 hover:text-red-400 hover:bg-red-500/10 rounded-xl"
            onClick={logout}
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>
    </>
  )
}
