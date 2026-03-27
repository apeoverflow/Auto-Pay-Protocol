import { getDb } from './index.js'

const CODE_TTL_MINUTES = 10

/** Generate a 6-digit code and store it */
export async function createVerificationCode(databaseUrl: string, email: string): Promise<string> {
  const db = getDb(databaseUrl)
  const code = String(Math.floor(100000 + Math.random() * 900000))
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000)

  // Invalidate any existing unused codes for this email
  await db`
    UPDATE email_verification_codes SET used = true
    WHERE email = ${email.toLowerCase()} AND used = false
  `

  await db`
    INSERT INTO email_verification_codes (email, code, expires_at)
    VALUES (${email.toLowerCase()}, ${code}, ${expiresAt})
  `

  return code
}

/** Verify a code — returns true if valid, marks it as used */
export async function verifyCode(databaseUrl: string, email: string, code: string): Promise<boolean> {
  const db = getDb(databaseUrl)

  const rows = await db`
    UPDATE email_verification_codes
    SET used = true
    WHERE email = ${email.toLowerCase()}
      AND code = ${code}
      AND used = false
      AND expires_at > NOW()
    RETURNING id
  `

  return rows.length > 0
}
