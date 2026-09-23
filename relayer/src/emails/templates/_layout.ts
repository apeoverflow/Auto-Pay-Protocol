/**
 * Shared HTML shell for transactional emails.
 *
 * Every template (verify, low-approval, approval-recovered, and any
 * future ones) renders the same outer chrome: F5F5F7 canvas → white
 * rounded card → dark header with the AutoPay wordmark → body slot →
 * subtle divider → footer slot. Centralising it here means:
 *   • one place to swap the logo / tweak spacing / restyle the footer
 *   • templates focus on their content, not their scaffolding
 *   • escapeHtml is defined once, not three times
 */

const LOGO_URL = 'https://autopayprotocol.com/logo.png'

export interface LayoutParams {
  /** Uppercased eyebrow above the headline (e.g. "Low USDC Approval"). */
  eyebrow: string
  /** The body HTML (already escaped where needed). */
  bodyHtml: string
  /** Optional card width in px. Defaults to 480. Low-approval uses 520 for the plan table. */
  widthPx?: number
  /** Optional footer HTML. Defaults to just the brand line; low-approval and
   *  approval-recovered add an unsubscribe link. */
  footerHtml?: string
}

export function renderLayout(params: LayoutParams): string {
  const width = params.widthPx ?? 480
  const footer = params.footerHtml ?? `
    <p style="margin: 0; font-size: 12px; color: #86868B; text-align: center;">
      AutoPay Protocol &mdash; Non-custodial subscription payments
    </p>`

  return `
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
        <table width="${width}" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08);">
          <tr>
            <td style="background-color: #1D1D1F; padding: 24px 32px; text-align: center;">
              <img src="${LOGO_URL}" alt="AutoPay Protocol" height="28" style="display: block; margin: 0 auto;" />
            </td>
          </tr>
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #86868B; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600;">
                ${escapeHtml(params.eyebrow)}
              </p>
              ${params.bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="padding: 16px 32px 20px; border-top: 1px solid #f0f0f0; text-align: center;">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim()
}

/**
 * HTML-escape a string for inclusion in element text or attribute values.
 * Handles the standard set: & < > " '.
 */
export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  } as Record<string, string>)[c]!)
}

/**
 * Primary blue CTA button. All templates use the same shape.
 */
export function renderCtaButton(label: string, href: string): string {
  return `
    <table cellpadding="0" cellspacing="0" style="margin: 0 auto 8px;">
      <tr>
        <td style="background-color: #0052FF; border-radius: 12px;">
          <a href="${escapeHtml(href)}" style="display: inline-block; padding: 14px 28px; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 15px;">
            ${escapeHtml(label)}
          </a>
        </td>
      </tr>
    </table>`
}

/**
 * Footer variant that includes an unsubscribe link. Used by low-approval
 * and approval-recovered emails.
 */
export function renderFooterWithUnsubscribe(unsubscribeUrl: string): string {
  return `
    <p style="margin: 0 0 6px; font-size: 12px; color: #86868B;">
      AutoPay Protocol &mdash; Non-custodial subscription payments
    </p>
    <p style="margin: 0; font-size: 12px; color: #86868B;">
      <a href="${escapeHtml(unsubscribeUrl)}" style="color: #86868B; text-decoration: underline;">Unsubscribe from these alerts</a>
    </p>`
}
