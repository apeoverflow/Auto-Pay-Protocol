/**
 * Pure state machine for the low-approval monitor.
 *
 * Kept side-effect-free so it can be unit-tested exhaustively without a
 * DB, RPC, or clock. The impure loop (approval.ts) fetches inputs from
 * Postgres + the chain, feeds them here, and applies the returned
 * `Action` back to the world.
 */

export interface MonitorState {
  /** Stage 0 = not in low-approval state; 1..maxStage = escalating stages. */
  notificationStage: number
  /** Whether the payer opted out — always short-circuits. */
  notificationsOptedOut: boolean
  /** When we first detected the current low-approval streak (null when clear). */
  lowApprovalSince: Date | null
  /** Cadence gate — do not notify again until this time is in the past. */
  nextNotificationAt: Date | null
  /** Whether the payer has a verified reachable email. Unverified → no notify. */
  emailVerified: boolean
}

export interface MonitorObservation {
  /** Current USDC allowance of payer → PolicyManager, in µUSDC. */
  currentAllowanceMicro: bigint
  /** Materialised 12-month projected billing, in µUSDC. */
  projected12moMicro: bigint
}

export interface MonitorConfig {
  /** Basis-points threshold (1000 = 10%): if allowance < projection * bps/10000 → low approval. */
  thresholdBps: number
  /** Backoff between notifications, in days per stage. First entry usually 0
   *  so stage-1 fires immediately upon first detection. */
  backoffDays: number[]
}

/**
 * The three actions the loop can take. `newStage` and other fields are the
 * values the loop should write back to the DB (via a CAS UPDATE keyed on
 * the pre-computed `priorStage` — see approval.ts).
 */
export type Action =
  | {
      kind: 'notify'
      priorStage: number
      newStage: number
      lowApprovalSince: Date
      nextNotificationAt: Date
      thresholdMicro: bigint
    }
  | {
      kind: 'reset'
      priorStage: number
    }
  | { kind: 'noop' }

export function computeThresholdMicro(projection: bigint, thresholdBps: number): bigint {
  // (projection * bps) / 10000 — integer math, floor.
  return (projection * BigInt(thresholdBps)) / 10000n
}

export function decide(
  state: MonitorState,
  observed: MonitorObservation,
  config: MonitorConfig,
  now: Date
): Action {
  // Opted out or unverified: never emit anything. The loop should still
  // update telemetry columns (last_checked_at etc.) but not enqueue email.
  if (state.notificationsOptedOut || !state.emailVerified) {
    return { kind: 'noop' }
  }

  // No projection = no risk to warn about (payer has no active subscriptions
  // or their remaining caps sum to zero). Treat as recovered if we were in a
  // low-approval state, otherwise noop.
  if (observed.projected12moMicro === 0n) {
    return state.notificationStage > 0
      ? { kind: 'reset', priorStage: state.notificationStage }
      : { kind: 'noop' }
  }

  const threshold = computeThresholdMicro(observed.projected12moMicro, config.thresholdBps)
  const inLowApproval = observed.currentAllowanceMicro < threshold

  // Recovered: allowance climbed back above threshold while we were escalating.
  if (!inLowApproval) {
    return state.notificationStage > 0
      ? { kind: 'reset', priorStage: state.notificationStage }
      : { kind: 'noop' }
  }

  // In low approval — is this tick allowed to notify?
  const cadenceDue = state.nextNotificationAt === null
                     || state.nextNotificationAt.getTime() <= now.getTime()
  if (!cadenceDue) return { kind: 'noop' }

  const maxStage = Math.max(config.backoffDays.length, 1) // safety
  const priorStage = state.notificationStage
  const newStage = Math.min(priorStage + 1, maxStage)

  // Backoff index — clamp to last entry when we've saturated.
  const backoffIdx = Math.min(priorStage, config.backoffDays.length - 1)
  const backoffDays = config.backoffDays[backoffIdx] ?? config.backoffDays[config.backoffDays.length - 1] ?? 30
  const backoffMs = Math.max(0, Math.round(backoffDays * 24 * 3600 * 1000))
  const nextNotificationAt = new Date(now.getTime() + backoffMs)

  return {
    kind: 'notify',
    priorStage,
    newStage,
    lowApprovalSince: state.lowApprovalSince ?? now,
    nextNotificationAt,
    thresholdMicro: threshold,
  }
}
