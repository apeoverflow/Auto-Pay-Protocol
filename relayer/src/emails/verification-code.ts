/** Branded verification code email template */
export function verificationCodeEmail(code: string): { subject: string; html: string } {
  return {
    subject: `${code} is your AutoPay verification code`,
    html: `
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
          <!-- Header -->
          <tr>
            <td style="background-color: #1D1D1F; padding: 24px 32px; text-align: center;">
              <img src="https://autopayprotocol.com/logo.png" alt="AutoPay Protocol" height="28" style="display: block; margin: 0 auto;" />
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding: 40px 32px;">
              <p style="margin: 0 0 8px; font-size: 14px; color: #86868B; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 600;">
                Verification Code
              </p>
              <div style="background-color: #f5f5f7; border-radius: 12px; padding: 20px; text-align: center; margin: 16px 0 24px;">
                <span style="font-family: 'SF Mono', Menlo, monospace; font-size: 36px; font-weight: 700; letter-spacing: 0.3em; color: #1D1D1F;">
                  ${code}
                </span>
              </div>
              <p style="margin: 0 0 16px; font-size: 15px; color: #1D1D1F; line-height: 1.6;">
                Enter this code in the app to verify your email and complete your merchant registration.
              </p>
              <p style="margin: 0; font-size: 13px; color: #86868B; line-height: 1.5;">
                This code expires in 10 minutes. If you didn't request this, you can safely ignore this email.
              </p>
            </td>
          </tr>
          <!-- Footer -->
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
</html>`.trim(),
  }
}
