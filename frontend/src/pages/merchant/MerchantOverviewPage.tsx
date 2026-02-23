import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { useMerchantStats } from '../../hooks/useMerchantStats'
import { FileText, Users, DollarSign, ArrowRight, Plus, Loader2 } from 'lucide-react'
import type { NavItem } from '../../components/layout/Sidebar'
import type { Route } from '../../hooks/useRoute'

interface MerchantOverviewPageProps {
  onNavigate: (page: NavItem) => void
  navigate: (to: Route, search?: string) => void
}

function formatUSD(amount: string | number) {
  const val = typeof amount === 'string' ? parseFloat(amount) : amount
  return val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function MerchantOverviewPage({ onNavigate, navigate }: MerchantOverviewPageProps) {
  const { plans, planCounts, activeSubscribers, totalRevenue, isLoading } = useMerchantStats()

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 h-full">
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500/15 to-indigo-500/10">
              <FileText className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Plans</p>
              <p className="text-2xl font-bold tabular-nums">{planCounts.total}</p>
              <p className="text-xs text-muted-foreground">
                {planCounts.active} active, {planCounts.draft} draft
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/15 to-teal-500/10">
              <Users className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Subscribers</p>
              <p className="text-2xl font-bold tabular-nums">{activeSubscribers}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/15 to-purple-500/10">
              <DollarSign className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold tabular-nums">${formatUSD(totalRevenue)}</p>
              <p className="text-xs text-muted-foreground">USDC</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Plans */}
      <Card className="flex-1 flex flex-col min-h-0 mb-6">
        <CardHeader className="flex flex-row items-center justify-between py-4 px-5 border-b border-border/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/10 to-primary/5">
              <FileText className="h-4 w-4 text-primary" />
            </div>
            <CardTitle className="text-[15px] font-semibold">Recent Plans</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => navigate('/merchant/plans/new')}
              className="h-8 text-xs gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              Create Plan
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onNavigate('merchant-plans')}
              className="text-muted-foreground h-8 text-xs hover:text-primary gap-1.5 group/btn"
            >
              View all
              <ArrowRight className="h-3 w-3 transition-transform group-hover/btn:translate-x-0.5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0 flex-1 flex flex-col min-h-0">
          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <p className="text-sm text-muted-foreground">No plans yet</p>
              <Button
                size="sm"
                onClick={() => onNavigate('merchant-plans')}
                className="gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                Create Plan
              </Button>
            </div>
          ) : (
            <div className="divide-y divide-border/40 flex-1 overflow-y-auto">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="flex items-center justify-between px-5 py-3 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => navigate('/merchant/plans/edit', `?id=${plan.id}`)}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {plan.planName || plan.id}
                    </p>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-3 ml-4">
                    {plan.amount != null && (
                      <span className="text-sm font-medium tabular-nums">
                        ${formatUSD(plan.amount)} / {plan.intervalLabel || 'month'}
                      </span>
                    )}
                    <StatusBadge status={plan.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'active':
      return <Badge variant="success" className="text-[10px]">Active</Badge>
    case 'draft':
      return <Badge variant="secondary" className="text-[10px]">Draft</Badge>
    case 'archived':
      return <Badge variant="outline" className="text-[10px]">Archived</Badge>
    default:
      return <Badge variant="outline" className="text-[10px]">{status}</Badge>
  }
}
