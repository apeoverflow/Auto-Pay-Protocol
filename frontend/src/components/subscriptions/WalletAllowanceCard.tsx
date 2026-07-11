import * as React from 'react'
import { Shield, AlertTriangle, Loader2 } from 'lucide-react'
import { maxUint128, maxUint256, parseUnits } from 'viem'
import { useApproval, useChain } from '../../hooks'
import { formatUSDC } from '../../types/subscriptions'
import { USDC_DECIMALS, UNLIMITED_APPROVAL_THRESHOLD } from '../../config'
import { isTempoBuild } from '../../contexts/TempoWalletContext'
import type { OnChainPolicy } from '../../types/policy'

interface WalletAllowanceCardProps {
  policies: OnChainPolicy[]
}

type EditMode = 'add' | 'reduce'

export function WalletAllowanceCard({ policies }: WalletAllowanceCardProps) {
  const { chainConfig } = useChain()
  const { allowance, allowanceLoaded, approve, isLoading: isApproving, error: approveError } = useApproval(chainConfig.policyManager)
  const isTempo = isTempoBuild()
  const [confirmingRevoke, setConfirmingRevoke] = React.useState(false)
  const [editing, setEditing] = React.useState(false)
  const [editMode, setEditMode] = React.useState<EditMode>('add')
  const [editInput, setEditInput] = React.useState('')
  const [editError, setEditError] = React.useState<string | null>(null)

  const activePolicies = policies.filter((p) => p.active)
  if (activePolicies.length === 0) return null

  const isApprovalUnlimited = allowance >= UNLIMITED_APPROVAL_THRESHOLD
  const anyUnlimitedPolicy = activePolicies.some((p) => p.spendingCap === 0n)

  // Sum of remaining caps across active finite-cap subscriptions.
  const committed = activePolicies.reduce((sum, p) => {
    if (p.spendingCap === 0n) return sum
    const remaining = p.spendingCap > p.totalSpent ? p.spendingCap - p.totalSpent : 0n
    return sum + remaining
  }, 0n)

  // Total ever charged via AutoPay for this wallet — useful framing for
  // "approval is X, you've spent Y" even though we can't precisely pin spend to
  // the *current* approval window without indexing the Approval event log.
  const totalSpent = policies.reduce((sum, p) => sum + p.totalSpent, 0n)

  const committedIsUnbounded = anyUnlimitedPolicy
  // Only warn once the on-chain allowance has actually been read — otherwise the
  // initial 0n would falsely flag an unlimited-approval user as under-committed.
  const underCommitted =
    allowanceLoaded && !isApprovalUnlimited && !committedIsUnbounded && allowance < committed

  // Parse the input as a delta in 6-decimal USDC; invalid → null.
  const parsedDelta = (() => {
    if (!editInput) return null
    const val = parseFloat(editInput)
    if (isNaN(val) || val < 0) return null
    return parseUnits(val.toFixed(USDC_DECIMALS), USDC_DECIMALS)
  })()

  // What allowance will the next approval call set?
  // - Unlimited current: input is the new *absolute* amount (user is scoping down).
  // - Finite + Add: current + delta.
  // - Finite + Reduce: max(0, current - delta).
  const projectedAllowance = parsedDelta === null
    ? null
    : isApprovalUnlimited
      ? parsedDelta
      : editMode === 'add'
        ? allowance + parsedDelta
        : parsedDelta > allowance ? 0n : allowance - parsedDelta

  const closeEditor = () => {
    setEditing(false)
    setEditMode('add')
    setEditInput('')
    setEditError(null)
  }

  const setApprovalTo = async (newAmount: bigint) => {
    try {
      await approve(newAmount)
      closeEditor()
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Approval failed')
    }
  }

  const handleRevoke = async () => {
    try {
      await approve(0n)
      setConfirmingRevoke(false)
    } catch {
      // surfaced via approveError
    }
  }

  const handleSetUnlimited = () => {
    setEditError(null)
    setApprovalTo(chainConfig.chain.id === 420420419 ? maxUint128 : maxUint256)
  }

  const handleApply = () => {
    if (parsedDelta === null) { setEditError('Enter a valid amount'); return }
    if (parsedDelta === 0n) { setEditError('Enter an amount greater than zero'); return }
    if (!isApprovalUnlimited && editMode === 'reduce' && parsedDelta > allowance) {
      setEditError(`Can't reduce by more than the ${formatUSDC(allowance)} remaining authorization`)
      return
    }
    const newAmount = projectedAllowance!
    // Soft guard: warn the first time the user tries to drop the approval below
    // what's already committed; a second click confirms.
    if (!committedIsUnbounded && newAmount < committed && editError === null) {
      setEditError(`The new authorization of ${formatUSDC(newAmount)} is below the ${formatUSDC(committed)} committed to active subscriptions — upcoming charges may fail. Click Save again to confirm.`)
      return
    }
    setApprovalTo(newAmount)
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Shield className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              Wallet authorization
            </span>
            <span className="text-[13px] font-semibold tabular-nums">
              {!allowanceLoaded ? '—' : isApprovalUnlimited ? 'Unlimited' : formatUSDC(allowance)}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {isApprovalUnlimited
              ? 'Subscriptions can charge any amount, limited only by each plan’s spending cap and your balance.'
              : `Approved for the AutoPay contract to charge across all your subscriptions.`}
          </p>

          {totalSpent > 0n && (
            <div className="mt-2.5 flex items-center justify-between text-[12px]">
              <span className="text-muted-foreground">Total charged via AutoPay (lifetime)</span>
              <span className="font-medium tabular-nums">{formatUSDC(totalSpent)}</span>
            </div>
          )}

          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            <span className="text-muted-foreground">Committed to active subscriptions</span>
            <span className="font-medium tabular-nums">
              {committedIsUnbounded ? 'Unlimited' : formatUSDC(committed)}
            </span>
          </div>

          {underCommitted && (
            <div className="mt-2.5 flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-[11px] text-amber-700">
              <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
              <span>
                Your authorization ({formatUSDC(allowance)}) is below the {formatUSDC(committed)} committed
                across active subscriptions — some upcoming charges may fail until you increase it.
              </span>
            </div>
          )}

          {/* Tempo: server-managed approval, no edit/revoke UI applicable. */}
          {allowanceLoaded && isTempo && (
            <div className="mt-3 pt-3 border-t border-border/40">
              <p className="text-[11px] text-muted-foreground">
                This wallet manages approval automatically — adjustments aren't available here.
              </p>
            </div>
          )}

          {/* Manage authorization (standard wallets only) */}
          {allowanceLoaded && !isTempo && (
            <div className="mt-3 pt-3 border-t border-border/40">
              {/* Inline edit / revoke triggers */}
              {!editing && !confirmingRevoke && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => { setEditing(true); setEditError(null) }}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    Change authorization
                  </button>
                  {allowance > 0n && (
                    <button
                      onClick={() => setConfirmingRevoke(true)}
                      className="text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors"
                    >
                      Revoke
                    </button>
                  )}
                </div>
              )}

              {/* Edit editor — relative add/reduce with live preview */}
              {editing && (
                <div className="space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    {isApprovalUnlimited
                      ? <>Your approval is currently <strong>Unlimited</strong>. Scope it to a finite amount, or set unlimited again.</>
                      : <>You have <strong>{formatUSDC(allowance)}</strong> of authorization remaining{totalSpent > 0n && <> ({formatUSDC(totalSpent)} already charged via AutoPay)</>}. Add to it or reduce what's left.</>
                    }
                  </p>

                  {!isApprovalUnlimited && allowance > 0n && (
                    <div className="inline-flex gap-1 rounded-md border border-border bg-muted/30 p-0.5">
                      <button
                        onClick={() => { setEditMode('add'); setEditError(null) }}
                        className={`text-[11px] px-2.5 py-1 rounded ${editMode === 'add' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        + Add
                      </button>
                      <button
                        onClick={() => { setEditMode('reduce'); setEditError(null) }}
                        className={`text-[11px] px-2.5 py-1 rounded ${editMode === 'reduce' ? 'bg-background shadow-sm font-medium' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        − Reduce
                      </button>
                    </div>
                  )}

                  <div className="flex gap-1.5 items-center">
                    <div className="relative flex-1">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={editMode === 'reduce' && !isApprovalUnlimited ? Number(allowance) / 10 ** USDC_DECIMALS : undefined}
                        placeholder={
                          isApprovalUnlimited
                            ? 'New authorization in USDC'
                            : editMode === 'add' ? 'Amount to add (USDC)' : 'Amount to reduce by (USDC)'
                        }
                        value={editInput}
                        onChange={(e) => { setEditInput(e.target.value); setEditError(null) }}
                        onKeyDown={(e) => e.key === 'Enter' && handleApply()}
                        className="w-full h-8 pl-6 pr-2 rounded-md border border-border bg-background text-xs focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <button
                      onClick={handleApply}
                      disabled={!editInput || isApproving}
                      className="inline-flex items-center gap-1 h-8 px-3 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
                    >
                      {isApproving && <Loader2 className="h-3 w-3 animate-spin" />}
                      Save
                    </button>
                  </div>

                  {projectedAllowance !== null && parsedDelta !== null && parsedDelta > 0n && (
                    <p className="text-[11px] text-muted-foreground">
                      New authorization: <strong className="text-foreground tabular-nums">{formatUSDC(projectedAllowance)}</strong>
                    </p>
                  )}

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSetUnlimited}
                      disabled={isApproving}
                      className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Set unlimited
                    </button>
                    <button
                      onClick={closeEditor}
                      disabled={isApproving}
                      className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {editError && <p className="text-[11px] text-amber-600">{editError}</p>}
                  {approveError && <p className="text-[11px] text-red-500">{approveError}</p>}
                </div>
              )}

              {/* Revoke confirm */}
              {confirmingRevoke && (
                <div className="space-y-1.5">
                  <p className="text-[11px] text-muted-foreground">
                    This sets your USDC approval to zero. All active subscriptions will stop charging until you re-authorize.
                  </p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRevoke}
                      disabled={isApproving}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-destructive hover:underline disabled:opacity-50"
                    >
                      {isApproving && <Loader2 className="h-3 w-3 animate-spin" />}
                      Confirm revoke
                    </button>
                    <button
                      onClick={() => setConfirmingRevoke(false)}
                      disabled={isApproving}
                      className="text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  {approveError && <p className="text-[11px] text-red-500">{approveError}</p>}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
