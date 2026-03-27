import * as React from 'react'
import { Card, CardContent } from '../../components/ui/card'
import { Button } from '../../components/ui/button'
import { Badge } from '../../components/ui/badge'
import { useMerchantPlans } from '../../hooks/useMerchantPlans'
import { useWallet } from '../../hooks/useWallet'
import { patchPlan, deletePlan } from '../../lib/relayer'
import { useSignMessageCompat } from '../../hooks/useSignMessageCompat'
import { Plus, Loader2, Pencil, Archive, ArchiveRestore, Trash2, Link2 } from 'lucide-react'
import type { NavItem } from '../../components/layout/Sidebar'
import { PaymentLinkDialog } from '../../components/merchant/PaymentLinkDialog'

type StatusFilter = 'all' | 'draft' | 'active' | 'archived'

interface MerchantPlansPageProps {
  onNavigate: (page: NavItem) => void
}

function formatUSD(amount: number | null) {
  if (amount == null) return '-'
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function MerchantPlansPage({ onNavigate: _onNavigate }: MerchantPlansPageProps) {
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('all')
  const apiFilter = statusFilter === 'all' ? undefined : statusFilter
  const { plans, isLoading, error, refetch } = useMerchantPlans(apiFilter)
  const { address } = useWallet()
  const { signMessageAsync } = useSignMessageCompat()
  const [actionLoading, setActionLoading] = React.useState<string | null>(null)
  const [actionError, setActionError] = React.useState<string | null>(null)
  const [sharePlanId, setSharePlanId] = React.useState<string | null>(null)
  const sharePlan = sharePlanId ? plans.find((p) => p.id === sharePlanId) : null

  // Fetch all plans (unfiltered) to calculate active plan count for limit check
  const { plans: allPlans } = useMerchantPlans()
  const MAX_PLANS = 2
  const activePlanCount = allPlans.filter(p => p.status !== 'archived').length
  const atPlanLimit = activePlanCount >= MAX_PLANS

  const handleNavigateNew = () => {
    window.history.pushState(null, '', '/merchant/plans/new')
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleNavigateEdit = (planId: string) => {
    window.history.pushState(null, '', `/merchant/plans/edit?id=${planId}`)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }

  const handleArchive = async (planId: string) => {
    if (!address) return
    if (!confirm('Archive this plan? Subscribers will keep their policies, but the plan won\'t appear in new checkouts.')) return
    setActionLoading(planId)
    setActionError(null)
    try {
      await patchPlan(address, planId, { status: 'archived' }, signMessageAsync)
      await refetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to archive plan')
    } finally {
      setActionLoading(null)
    }
  }

  const handleActivate = async (planId: string) => {
    if (!address) return
    setActionLoading(planId)
    setActionError(null)
    try {
      await patchPlan(address, planId, { status: 'active' }, signMessageAsync)
      await refetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to activate plan')
    } finally {
      setActionLoading(null)
    }
  }

  const handleDelete = async (planId: string) => {
    if (!address) return
    if (!confirm('Permanently delete this plan? This cannot be undone.')) return
    setActionLoading(planId)
    setActionError(null)
    try {
      await deletePlan(address, planId, signMessageAsync)
      await refetch()
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to delete plan')
    } finally {
      setActionLoading(null)
    }
  }

  const tabs: { label: string; value: StatusFilter }[] = [
    { label: 'All', value: 'all' },
    { label: 'Draft', value: 'draft' },
    { label: 'Active', value: 'active' },
    { label: 'Archived', value: 'archived' },
  ]

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide -mx-3 px-3 md:mx-0 md:px-0">
          {tabs.map((tab) => (
            <Button
              key={tab.value}
              variant={statusFilter === tab.value ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setStatusFilter(tab.value)}
              className={
                statusFilter === tab.value
                  ? 'h-8 text-[12px] md:text-xs shadow-sm flex-shrink-0 rounded-lg'
                  : 'h-8 text-[12px] md:text-xs text-muted-foreground hover:text-foreground flex-shrink-0 rounded-lg'
              }
            >
              {tab.label}
            </Button>
          ))}
        </div>

        <Button size="sm" className="gap-1.5" onClick={handleNavigateNew} disabled={atPlanLimit} title={atPlanLimit ? `Limit of ${MAX_PLANS} plans reached. Archive a plan to create a new one.` : undefined}>
          <Plus className="h-3.5 w-3.5" />
          {atPlanLimit ? `Limit Reached (${MAX_PLANS})` : 'Create Plan'}
        </Button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={refetch}>
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Action Error */}
      {actionError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {actionError}
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && plans.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 gap-3">
            <p className="text-sm text-muted-foreground">
              {statusFilter === 'all' ? 'No plans yet. Create your first plan to get started.' : `No ${statusFilter} plans.`}
            </p>
            {statusFilter === 'all' && !atPlanLimit && (
              <Button size="sm" className="gap-1.5" onClick={handleNavigateNew}>
                <Plus className="h-3.5 w-3.5" />
                Create Plan
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {/* Plans grid */}
      {!isLoading && !error && plans.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {plans.map((plan) => (
            <Card key={plan.id} className="flex flex-col">
              <CardContent className="flex flex-1 flex-col gap-3 p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {plan.planName || plan.id}
                    </p>
                    {plan.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {plan.description}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={plan.status} />
                </div>

                {plan.amount != null && (
                  <div className="text-lg font-bold tabular-nums">
                    ${formatUSD(plan.amount)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">
                      / {plan.intervalLabel || 'month'}
                    </span>
                  </div>
                )}

                {plan.tier && (
                  <Badge variant="outline" className="self-start text-[10px]">
                    {plan.tier}
                  </Badge>
                )}

                {/* Actions */}
                <div className="flex items-center gap-1.5 mt-auto pt-2 border-t border-border/40">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => handleNavigateEdit(plan.id)}
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </Button>

                  {plan.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => setSharePlanId(plan.id)}
                    >
                      <Link2 className="h-3 w-3" />
                      Share Link
                    </Button>
                  )}

                  {plan.status === 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={actionLoading === plan.id}
                      onClick={() => handleArchive(plan.id)}
                    >
                      {actionLoading === plan.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Archive className="h-3 w-3" />
                      )}
                      Archive
                    </Button>
                  )}

                  {(plan.status === 'draft' || plan.status === 'archived') && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={actionLoading === plan.id}
                      onClick={() => handleActivate(plan.id)}
                    >
                      {actionLoading === plan.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <ArchiveRestore className="h-3 w-3" />
                      )}
                      Activate
                    </Button>
                  )}

                  {plan.status !== 'active' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                      disabled={actionLoading === plan.id}
                      onClick={() => handleDelete(plan.id)}
                    >
                      {actionLoading === plan.id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Delete
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      {/* Payment Link Dialog */}
      {sharePlan && address && (
        <PaymentLinkDialog
          open={!!sharePlan}
          onOpenChange={(open) => { if (!open) setSharePlanId(null) }}
          plan={sharePlan}
          merchantAddress={address}
          signMessage={signMessageAsync}
        />
      )}
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
