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

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f7; font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', Roboto, sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f7; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color: #1D1D1F; padding: 24px 32px; text-align: center;">
              <img src="https://autopayprotocol.com/logo.png" alt="AutoPay Protocol" height="28" style="display: block; margin: 0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #86868B; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600;">
                Confirm your email
              </p>
              <h1 style="margin: 0 0 16px; font-size: 22px; font-weight: 700; color: #1D1D1F; letter-spacing: -0.02em;">
                One quick tap to enable subscription alerts
              </h1>
              <p style="margin: 0 0 24px; font-size: 15px; color: #1D1D1F; line-height: 1.6;">
                You just subscribed to <strong>${escapeHtml(context)}</strong> using AutoPay. Confirming your email lets us warn you if your subscription is about to fail — for example, if your USDC approval is running low.
              </p>
              <table cellpadding="0" cellspacing="0" style="margin: 0 auto 24px;">
                <tr>
                  <td style="background-color: #0052FF; border-radius: 12px;">
                    <a href="${escapeAttr(params.verifyUrl)}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px; letter-spacing: 0.01em;">
                      Confirm my email
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 0 0 8px; font-size: 12px; color: #86868B; line-height: 1.5;">
                Or paste this into your browser:
              </p>
              <p style="margin: 0 0 20px; font-size: 12px; color: #86868B; word-break: break-all; font-family: 'SF Mono', Menlo, monospace;">
                ${escapeHtml(params.verifyUrl)}
              </p>
              <p style="margin: 0; font-size: 13px; color: #86868B; line-height: 1.5;">
                This link expires in 7 days. If you did not subscribe, you can safely ignore this email — no notifications will be sent.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #f0f0f0;">
              <p style="margin: 0; font-size: 12px; color: #86868B; text-align: center;">
                AutoPay Protocol &mdash; Non-custodial subscription payments
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()

  return { subject, html, text }
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]!)
}

function escapeAttr(s: string): string {
  return escapeHtml(s)
}
