import { Resend } from 'resend'
import { createLogger } from '../utils/logger.js'
import { verificationCodeEmail } from './verification-code.js'

const logger = createLogger('emails')

let resend: Resend | null = null

function getResend(): Resend {
  if (!resend) {
    const key = process.env.RESEND_API_KEY
    if (!key) throw new Error('RESEND_API_KEY not configured')
    resend = new Resend(key)
  }
  return resend
}

const FROM_ADDRESS = process.env.RESEND_FROM || 'AutoPay <noreply@autopayprotocol.com>'

export async function sendVerificationCode(email: string, code: string): Promise<void> {
  const r = getResend()
  const { subject, html } = verificationCodeEmail(code)

  const { error } = await r.emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject,
    html,
  })

  if (error) {
    logger.error({ error, email }, 'Failed to send verification email')
    throw new Error('Failed to send verification email')
  }

  logger.info({ email }, 'Verification code sent')
}
