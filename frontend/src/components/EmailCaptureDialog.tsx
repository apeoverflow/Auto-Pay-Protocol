import * as React from 'react'
import {
  Dialog,
  DialogContent,
} from './ui/dialog'
import { supabase } from '../lib/supabase'
import { Loader2, CheckCircle, Trophy, ArrowRight, Sparkles } from 'lucide-react'

interface EmailCaptureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function EmailCaptureDialog({ open, onOpenChange }: EmailCaptureDialogProps) {
  const [email, setEmail] = React.useState('')
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'success' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = React.useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!trimmed) return

    setStatus('loading')
    setErrorMsg('')

    if (!supabase) {
      setStatus('error')
      setErrorMsg('Service unavailable. Please try again later.')
      return
    }

    try {
      const { error } = await supabase
        .from('waitlist_emails')
        .insert({ email: trimmed, source: 'website' })

      if (error) {
        if (error.code === '23505') {
          setStatus('success')
        } else {
          setStatus('error')
          setErrorMsg('Something went wrong. Please try again.')
          console.warn('Waitlist insert error:', error)
        }
        return
      }

      setStatus('success')
    } catch {
      setStatus('error')
      setErrorMsg('Something went wrong. Please try again.')
    }
  }

  const handleClose = (value: boolean) => {
    onOpenChange(value)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="email-capture-dialog p-0 overflow-hidden max-w-[420px] border-0 shadow-2xl"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        {/* Dark hero header */}
        <div className="email-capture-header">
          <div className="email-capture-header-bg" />
          <div className="email-capture-header-content">
            <div className="email-capture-badge">
              <Trophy className="h-3.5 w-3.5" />
              <span>ETH Global Hack Money Finalist</span>
            </div>
            <h2 className="email-capture-title">
              Get Early Access
            </h2>
            <p className="email-capture-subtitle">
              New integrations, merchant tools, and early bird perks — straight to your inbox.
            </p>
          </div>
        </div>

        {/* Form / success body */}
        <div className="email-capture-body">
          {status === 'success' ? (
            <div className="email-capture-success">
              <div className="email-capture-success-icon">
                <CheckCircle className="h-6 w-6" />
              </div>
              <p className="email-capture-success-title">You're on the list!</p>
              <p className="email-capture-success-sub">
                We'll keep you posted on launches and early access perks.
              </p>
              <button
                onClick={() => handleClose(false)}
                className="email-capture-close-btn"
              >
                Done
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="email-capture-form">
              <div className="email-capture-input-row">
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === 'loading'}
                  className="email-capture-input"
                />
                <button
                  type="submit"
                  disabled={!email.trim() || status === 'loading'}
                  className="email-capture-submit"
                >
                  {status === 'loading' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Join
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </div>
              {status === 'error' && (
                <p className="email-capture-error">{errorMsg}</p>
              )}
              <div className="email-capture-perks">
                <div className="email-capture-perk">
                  <Sparkles className="h-3 w-3" />
                  <span>Early adopter perks</span>
                </div>
                <div className="email-capture-perk">
                  <Sparkles className="h-3 w-3" />
                  <span>Integration announcements</span>
                </div>
              </div>
              <p className="email-capture-fine-print">
                No spam, ever. Unsubscribe anytime.
              </p>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Hook to manage auto-open behavior */
export function useEmailCaptureDialog() {
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    const timer = setTimeout(() => setOpen(true), 1200)
    return () => clearTimeout(timer)
  }, [])

  return { open, setOpen }
}
