import { renderLayout, renderCtaButton, escapeHtml } from './_layout.js'

export interface VerifyEmailParams {
  verifyUrl: string
  planName?: string
  merchantName?: string
}

/**
 * Magic-link email a payer receives after providing their address at
 * checkout. Click confirms `email_verified_at`, unlocking low-approval
 * warnings (and exposure to the merchant subscribers API).
 *
 * Kept intentionally plain — no unsubscribe footer, because a user who
 * hasn't verified can't be added to any future send cadence yet.
 */
export function verifyEmail(params: VerifyEmailParams): { subject: string; html: string; text: string } {
  const context = params.planName && params.merchantName
    ? `${params.planName} from ${params.merchantName}`
    : params.planName ?? params.merchantName ?? 'your AutoPay subscription'

  const subject = 'Confirm your email for AutoPay notifications'

  const text = [
    `You just subscribed to ${context} using AutoPay.`,
    '',
    'Confirm your email address so we can warn you if your subscription',
    'is about to fail (e.g. your USDC approval is running low).',
    '',
    `Verify: ${params.verifyUrl}`,
    '',
    'This link expires in 7 days. If you did not subscribe, you can safely',
    'ignore this email — no notifications will be sent.',
  ].join('\n')

  const bodyHtml = `
    <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #1D1D1F; letter-spacing: -0.02em;">
      One quick tap to enable subscription alerts
    </h1>
    <p style="margin: 0 0 24px; font-size: 15px; color: #1D1D1F; line-height: 1.6;">
      You just subscribed to <strong>${escapeHtml(context)}</strong> using AutoPay. Confirming your email lets us warn you if your subscription is about to fail — for example, if your USDC approval is running low.
    </p>
    ${renderCtaButton('Confirm my email', params.verifyUrl)}
    <p style="margin: 24px 0 8px; font-size: 12px; color: #86868B; line-height: 1.5;">
      Or paste this into your browser:
    </p>
    <p style="margin: 0 0 20px; font-size: 12px; color: #86868B; word-break: break-all; font-family: 'SF Mono', Menlo, monospace;">
      ${escapeHtml(params.verifyUrl)}
    </p>
    <p style="margin: 0; font-size: 13px; color: #86868B; line-height: 1.5;">
      This link expires in 7 days. If you did not subscribe, you can safely ignore this email — no notifications will be sent.
    </p>`

  const html = renderLayout({ eyebrow: 'Confirm your email', bodyHtml })
  return { subject, html, text }
}
