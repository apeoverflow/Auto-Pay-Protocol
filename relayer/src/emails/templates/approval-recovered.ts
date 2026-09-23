import { renderLayout, renderFooterWithUnsubscribe, escapeHtml } from './_layout.js'

export interface ApprovalRecoveredEmailPayload {
  chainName: string
  unsubscribeUrl: string
}

/**
 * Confirmation email sent when a payer's allowance climbs back above the
 * threshold after they'd been warned. Kept intentionally short — this is
 * a "you're fine now" acknowledgement, not marketing. Enqueued by
 * `runApprovalMonitorOnce` in the RESET branch.
 */
export function approvalRecoveredEmail(p: ApprovalRecoveredEmailPayload): { subject: string; html: string; text: string } {
  const subject = `Your AutoPay approval is healthy again`

  const text = [
    `Good news — your USDC approval to AutoPay on ${p.chainName} is back above the low-approval threshold.`,
    '',
    "We'll only reach out again if it drops close to your projected billing.",
    '',
    `Unsubscribe: ${p.unsubscribeUrl}`,
  ].join('\n')

  const bodyHtml = `
    <h1 style="margin: 0 0 12px; font-size: 22px; font-weight: 700; color: #1D1D1F; letter-spacing: -0.02em;">
      Your approval is healthy again
    </h1>
    <p style="margin: 0 0 16px; font-size: 15px; color: #1D1D1F; line-height: 1.6;">
      Your USDC approval to AutoPay on <strong>${escapeHtml(p.chainName)}</strong> is back above the low-approval threshold. Your subscriptions will keep charging normally.
    </p>
    <p style="margin: 0; font-size: 13px; color: #86868B; line-height: 1.5;">
      We'll only reach out again if the approval drops close to your projected billing.
    </p>`

  const html = renderLayout({
    eyebrow: 'All clear',
    bodyHtml,
    footerHtml: renderFooterWithUnsubscribe(p.unsubscribeUrl),
  })
  return { subject, html, text }
}
