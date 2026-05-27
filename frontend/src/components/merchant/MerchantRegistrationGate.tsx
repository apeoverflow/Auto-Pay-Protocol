import { useState, useEffect, useCallback } from 'react'
import { Store, Mail, Loader2, CheckCircle2, KeyRound, ArrowLeft } from 'lucide-react'
import { useWallet, useSignMessageCompat } from '../../hooks'
import { checkMerchantAccount, registerMerchantAccount, sendEmailCode, verifyEmailCode } from '../../lib/relayer'

type Step = 'checking' | 'error' | 'email' | 'otp' | 'signing' | 'done'

/**
 * Inline gate shown on plan create/edit pages.
 * Flow: enter email -> verify via Supabase OTP -> sign with wallet -> registered.
 * Once registered, renders children. Skips if already registered.
 */
export function MerchantRegistrationGate({ children }: { children: React.ReactNode }) {
  const { address } = useWallet()
  const { signMessageAsync } = useSignMessageCompat()

  const [step, setStep] = useState<Step>('checking')
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const check = useCallback(async () => {
    if (!address) return
    setStep('checking')
    try {
      const result = await checkMerchantAccount(address)
      setStep(result.registered ? 'done' : 'email')
    } catch {
      if (import.meta.env.PROD) {
        setError('Could not reach server. Please try again.')
        setStep('error')
      } else {
        // Dev mode: let through if relayer is not running
        setStep('done')
      }
    }
  }, [address])

  useEffect(() => {
    check()
  }, [check])

  // Step 1: Send magic link
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setError(null)
    setSending(true)
    try {
      const { error: sendError } = await sendEmailCode(email)
      if (sendError) {
        setError(sendError)
      } else {
        setStep('otp')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send verification email')
    } finally {
      setSending(false)
    }
  }

  // Step 2: Verify OTP code
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!otp) return

    setError(null)
    setSending(true)
    try {
      const { error: verifyError } = await verifyEmailCode(email, otp)
      if (verifyError) {
        setError(verifyError)
      } else {
        setStep('signing')
        // Auto-trigger wallet signing
        await completeRegistration()
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed')
    } finally {
      setSending(false)
    }
  }

  // Step 3: Sign with wallet and register
  const completeRegistration = async () => {
    if (!address) return
    setError(null)
    try {
      await registerMerchantAccount(address, email, signMessageAsync)
      setStep('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed'
      if (message.toLowerCase().includes('user rejected') || message.toLowerCase().includes('denied')) {
        setError('Signature rejected. Please sign to verify wallet ownership.')
      } else {
        setError(message)
      }
      // Stay on signing step so they can retry
    }
  }

  if (step === 'checking') {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (step === 'error') {
    return (
      <div className="flex items-center justify-center min-h-[60vh] p-4">
        <div className="bg-card border border-border rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4 text-center">
          <p className="text-sm text-destructive">{error || 'Something went wrong'}</p>
          <button
            onClick={check}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return <>{children}</>
  }

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <div className="bg-card border border-border rounded-2xl shadow-xl max-w-lg w-full p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Store className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Create Merchant Account</h2>
            <p className="text-xs text-muted-foreground">
              {step === 'email' && 'Required before creating your first plan'}
              {step === 'otp' && 'Check your inbox for a verification code'}
              {step === 'signing' && 'One last step — sign with your wallet'}
            </p>
          </div>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 text-xs">
          <span className={`flex items-center gap-1 ${step === 'email' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            {step !== 'email' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <span className="w-5 h-5 rounded-full border-2 border-primary flex items-center justify-center text-[10px] font-bold">1</span>}
            Email
          </span>
          <div className="flex-1 h-px bg-border" />
          <span className={`flex items-center gap-1 ${step === 'otp' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            {step === 'signing' ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> : <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${step === 'otp' ? 'border-primary' : 'border-muted-foreground/30'}`}>2</span>}
            Verify
          </span>
          <div className="flex-1 h-px bg-border" />
          <span className={`flex items-center gap-1 ${step === 'signing' ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
            <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold ${step === 'signing' ? 'border-primary' : 'border-muted-foreground/30'}`}>3</span>
            Sign
          </span>
        </div>

        {/* Step 1: Email */}
        {step === 'email' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Enter your email to register as a merchant. We'll send a verification code.
            </p>
            <div>
              <label htmlFor="merchant-email" className="block text-sm font-medium mb-1.5">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="merchant-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={!email || sending}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Verification Code'
              )}
            </button>
          </form>
        )}

        {/* Step 2: OTP verification */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <p className="text-sm text-muted-foreground">
              We sent a 6-digit code to <span className="font-medium text-foreground">{email}</span>. Enter it below.
            </p>
            <div>
              <label htmlFor="otp-code" className="block text-sm font-medium mb-1.5">
                Verification code
              </label>
              <div className="relative">
                <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  required
                  autoFocus
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  placeholder="000000"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm tracking-[0.3em] font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              type="submit"
              disabled={otp.length < 6 || sending}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>

            <button
              type="button"
              onClick={() => { setStep('email'); setOtp(''); setError(null) }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Use a different email
            </button>
          </form>
        )}

        {/* Step 3: Wallet signature */}
        {step === 'signing' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Email verified. Sign a message with your wallet to link <span className="font-medium text-foreground">{email}</span> to your wallet address.
            </p>

            {error && (
              <p className="text-sm text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={() => completeRegistration()}
              disabled={sending}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-medium text-sm transition-all hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sign with wallet...
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Sign & Complete Registration
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
