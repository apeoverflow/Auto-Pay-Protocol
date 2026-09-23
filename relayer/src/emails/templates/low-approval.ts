import { renderLayout, renderCtaButton, renderFooterWithUnsubscribe, escapeHtml } from './_layout.js'

export interface LowApprovalEmailLine {
  policyId: string
  merchant: string
  merchantName: string | null
  planName: string | null
  chargeAmountMicro: string
  intervalSeconds: number
}

export interface LowApprovalEmailPayload {
  chainId: number
  chainName: string
  payer: string
  notificationStage: number
  allowanceMicro: string
  projected12moMicro: string
  thresholdMicro: string
  topUpSuggestionMicro: string
  topUpUrl: string
  unsubscribeUrl: string
  lines: LowApprovalEmailLine[]
}

export function lowApprovalEmail(p: LowApprovalEmailPayload): { subject: string; html: string; text: string } {
  const allowanceUsdc = fmtUsdc(BigInt(p.allowanceMicro))
  const projectionUsdc = fmtUsdc(BigInt(p.projected12moMicro))
  const topUpUsdc = fmtUsdc(BigInt(p.topUpSuggestionMicro))

  const affectedCount = p.lines.length
  const subjectTail = affectedCount === 1
    ? `your ${p.lines[0].merchantName ?? 'AutoPay'} subscription`
    : `${affectedCount} AutoPay subscriptions`

  // Escalate the subject line with the notification stage so users understand
  // this is a recurring reminder, not spam. Stage 1 = first warning.
  const stageLabel = p.notificationStage === 1
    ? ''
    : p.notificationStage <= 2 ? ' (reminder)'
    : ' (final reminder)'

  const subject = `Top up USDC to keep ${subjectTail} running${stageLabel}`

  const text = [
    `Your USDC approval to AutoPay is running low on ${p.chainName}.`,
    '',
    `  Current allowance:   ${allowanceUsdc}`,
    `  12-month projection: ${projectionUsdc}`,
    `  Suggested top-up:    ${topUpUsdc}`,
    '',
    `Without more approval, ${affectedCount === 1 ? 'this subscription' : 'these subscriptions'} will be cancelled after a few failed charges:`,
    ...p.lines.map((l) => `  • ${l.planName ?? 'Subscription'}${l.merchantName ? ` from ${l.merchantName}` : ''}: ${fmtUsdc(BigInt(l.chargeAmountMicro))} every ${humanInterval(l.intervalSeconds)}`),
    '',
    `Top up:      ${p.topUpUrl}`,
    `Unsubscribe: ${p.unsubscribeUrl}`,
  ].join('\n')

  const linesHtml = p.lines.map((l) => `
    <tr>
      <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0;">
        <div style="font-size: 15px; font-weight: 600; color: #1D1D1F;">${escapeHtml(l.planName ?? 'Subscription')}</div>
        ${l.merchantName ? `<div style="font-size: 13px; color: #86868B; margin-top: 2px;">${escapeHtml(l.merchantName)}</div>` : ''}
      </td>
      <td style="padding: 12px 0; border-bottom: 1px solid #f0f0f0; text-align: right; white-space: nowrap;">
        <div style="font-size: 15px; font-weight: 600; color: #1D1D1F;">${fmtUsdc(BigInt(l.chargeAmountMicro))}</div>
        <div style="font-size: 13px; color: #86868B; margin-top: 2px;">every ${humanInterval(l.intervalSeconds)}</div>
      </td>
    </tr>`).join('')

  const bodyHtml = `
    <h1 style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: #1D1D1F; letter-spacing: -0.02em;">
      Your ${affectedCount === 1 ? 'subscription needs' : 'subscriptions need'} a top-up
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: #1D1D1F; line-height: 1.6;">
      Your USDC approval to AutoPay on <strong>${escapeHtml(p.chainName)}</strong> is running low. Without more approval, ${affectedCount === 1 ? 'the subscription below' : 'the subscriptions below'} will be cancelled after a few failed charges.
    </p>

    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
      <tr>
        <td style="padding: 4px 12px; font-size: 13px; color: #86868B;">Current allowance</td>
        <td style="padding: 4px 12px; font-size: 15px; font-weight: 600; color: #1D1D1F; text-align: right;">${allowanceUsdc}</td>
      </tr>
      <tr>
        <td style="padding: 4px 12px; font-size: 13px; color: #86868B;">Projected 12-month billing</td>
        <td style="padding: 4px 12px; font-size: 15px; font-weight: 600; color: #1D1D1F; text-align: right;">${projectionUsdc}</td>
      </tr>
      <tr>
        <td style="padding: 4px 12px; font-size: 13px; color: #0052FF; font-weight: 600;">Suggested top-up</td>
        <td style="padding: 4px 12px; font-size: 15px; font-weight: 700; color: #0052FF; text-align: right;">${topUpUsdc}</td>
      </tr>
    </table>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
      <tr>
        <td colspan="2" style="padding: 0 0 8px; font-size: 12px; color: #86868B; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600;">
          Affected subscriptions
        </td>
      </tr>
      ${linesHtml}
    </table>

    ${renderCtaButton('Top up my approval', p.topUpUrl)}
    <p style="margin: 0 0 16px; font-size: 12px; color: #86868B; text-align: center;">
      Top-ups are handled in the AutoPay app; nothing is deducted here.
    </p>`

  const html = renderLayout({
    eyebrow: 'Low USDC Approval',
    widthPx: 520,
    bodyHtml,
    footerHtml: renderFooterWithUnsubscribe(p.unsubscribeUrl),
  })
  return { subject, html, text }
}

function fmtUsdc(micro: bigint): string {
  const whole = micro / 1_000_000n
  const fracRaw = (micro % 1_000_000n).toString().padStart(6, '0').slice(0, 2)
  return `$${whole.toString()}.${fracRaw} USDC`
}

function humanInterval(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`
  const days = Math.round(seconds / 86400)
  if (days < 14) return `${days} day${days === 1 ? '' : 's'}`
  if (days < 60) return `${Math.round(days / 7)} week${Math.round(days / 7) === 1 ? '' : 's'}`
  if (days < 365) return `${Math.round(days / 30)} month${Math.round(days / 30) === 1 ? '' : 's'}`
  return `${Math.round(days / 365)} year${Math.round(days / 365) === 1 ? '' : 's'}`
}
