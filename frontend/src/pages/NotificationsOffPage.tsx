import { useMemo } from 'react'

/**
 * Landing page after the relayer's /subscribers/unsubscribe endpoint runs.
 * The relayer 302-redirects here with ?status=<outcome>.
 */
export function NotificationsOffPage() {
  const status = useMemo(() => {
    if (typeof window === 'undefined') return 'ok'
    return new URLSearchParams(window.location.search).get('status') ?? 'ok'
  }, [])

  const copy = MESSAGES[status] ?? MESSAGES.unknown

  return (
    <div className="min-h-screen w-full bg-[#F5F5F7] flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-[0_4px_24px_rgba(0,0,0,0.06)] p-10 text-center">
        <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full" style={{ backgroundColor: copy.tint }}>
          <span aria-hidden style={{ fontSize: 28, lineHeight: 1 }}>{copy.icon}</span>
        </div>
        <p className="mb-2 text-xs font-semibold tracking-[0.14em] text-[#86868B] uppercase">
          {copy.eyebrow}
        </p>
        <h1 className="mb-3 text-[24px] font-bold tracking-tight text-[#1D1D1F]">
          {copy.title}
        </h1>
        <p className="mb-8 text-[15px] leading-relaxed text-[#1D1D1F]">
          {copy.body}
        </p>
        <a
          href="/"
          className="inline-flex items-center justify-center rounded-xl px-5 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: '#0052FF' }}
        >
          Back to AutoPay
        </a>
      </div>
    </div>
  )
}

const MESSAGES: Record<string, {
  eyebrow: string
  title: string
  body: string
  icon: string
  tint: string
}> = {
  ok: {
    eyebrow: 'Unsubscribed',
    title: "You won't get more of these",
    body: "You've been opted out of low-approval alerts. Your subscriptions still charge normally — this only stops the email warnings. If you change your mind, resubscribe at checkout with the same email.",
    icon: '✓',
    tint: '#E6F0FF',
  },
  invalid: {
    eyebrow: 'Bad link',
    title: 'This unsubscribe link is invalid',
    body: 'Copy the full URL from the email into your browser, or click the link again.',
    icon: '!',
    tint: '#F5F5F7',
  },
  unknown: {
    eyebrow: 'Notifications',
    title: 'Something unexpected happened',
    body: "We couldn't confirm the outcome. If the link came from an AutoPay email, please try it again.",
    icon: '?',
    tint: '#F5F5F7',
  },
}
