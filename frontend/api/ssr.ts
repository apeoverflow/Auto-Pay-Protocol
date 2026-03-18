import type { VercelRequest, VercelResponse } from '@vercel/node'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const config = { runtime: 'nodejs' }

// Routes that benefit from SSR (SEO + fast paint)
const SSR_ROUTES = ['/', '/docs', '/terms', '/privacy', '/checkout']

function isSSRRoute(pathname: string): boolean {
  if (SSR_ROUTES.includes(pathname)) return true
  if (pathname.startsWith('/pay/')) return true
  return false
}

interface CheckoutLinkData {
  merchant: string
  metadataUrl: string
  amount: string | number
  interval: number
  spendingCap?: string | number
  ipfsMetadataUrl?: string | null
  successUrl?: string | null
  cancelUrl?: string | null
  fields?: string
}

interface CheckoutMetadata {
  plan?: {
    name?: string
    description?: string
  }
  merchant?: {
    name?: string
    logo?: string
  }
}

async function fetchCheckoutData(
  shortId: string,
): Promise<{ link: CheckoutLinkData; metadata: CheckoutMetadata | null } | null> {
  const relayerUrl = process.env.VITE_RELAYER_URL
  if (!relayerUrl) return null

  try {
    const linkRes = await fetch(
      `${relayerUrl}/checkout-links/${encodeURIComponent(shortId)}`,
    )
    if (!linkRes.ok) return null
    const link = (await linkRes.json()) as CheckoutLinkData

    let metadata: CheckoutMetadata | null = null
    const metadataUrl = link.metadataUrl || link.ipfsMetadataUrl
    if (metadataUrl) {
      try {
        const metaRes = await fetch(metadataUrl)
        if (metaRes.ok) {
          metadata = (await metaRes.json()) as CheckoutMetadata
        }
      } catch {
        // Metadata fetch is best-effort
      }
    }

    return { link, metadata }
  } catch {
    return null
  }
}

function buildMetaTags(
  pathname: string,
  checkoutData?: { link: CheckoutLinkData; metadata: CheckoutMetadata | null } | null,
): string {
  const baseUrl = process.env.VITE_BASE_URL || 'https://autopayprotocol.com'
  const defaultImage = `${baseUrl}/og-image.png`

  let title = 'AutoPayProtocol'
  let description =
    'Non-custodial crypto subscription payments. 50% cheaper than Stripe, multi-chain USDC.'
  let image = defaultImage
  const url = `${baseUrl}${pathname}`

  if (pathname === '/') {
    title = 'AutoPayProtocol — Non-Custodial Crypto Subscriptions'
    description =
      'Non-custodial crypto subscription payments. 50% cheaper than Stripe, multi-chain USDC. Accept recurring payments from 30+ chains.'
  } else if (pathname === '/docs') {
    title = 'Documentation — AutoPayProtocol'
    description =
      'Developer documentation for AutoPayProtocol. SDK reference, merchant integration guide, relayer setup, and smart contract docs.'
  } else if (pathname === '/terms') {
    title = 'Terms of Service — AutoPayProtocol'
    description = 'AutoPayProtocol Terms of Service.'
  } else if (pathname === '/privacy') {
    title = 'Privacy Policy — AutoPayProtocol'
    description = 'AutoPayProtocol Privacy Policy.'
  } else if (pathname.startsWith('/pay/') && checkoutData) {
    const planName = checkoutData.metadata?.plan?.name
    const merchantName = checkoutData.metadata?.merchant?.name
    const amount = checkoutData.link.amount
    const merchantLogo = checkoutData.metadata?.merchant?.logo

    if (planName) {
      title = `Subscribe to ${planName}${merchantName ? ` by ${merchantName}` : ''} — AutoPayProtocol`
    } else {
      title = 'Subscribe — AutoPayProtocol'
    }

    const amountStr = amount ? `$${amount} USDC` : ''
    if (planName && amountStr) {
      description = `${planName} — ${amountStr} recurring subscription${merchantName ? ` from ${merchantName}` : ''}. Pay with crypto from 30+ chains.`
    } else {
      description = 'Complete your crypto subscription payment with AutoPayProtocol.'
    }

    if (merchantLogo) {
      image = merchantLogo
    }
  } else if (pathname === '/checkout') {
    title = 'Checkout — AutoPayProtocol'
    description = 'Complete your crypto subscription payment with AutoPayProtocol.'
  }

  return [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    `<meta property="og:image" content="${escapeHtml(image)}" />`,
    `<meta property="og:url" content="${escapeHtml(url)}" />`,
    `<meta property="og:site_name" content="AutoPayProtocol" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
    `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
    `<link rel="canonical" href="${escapeHtml(url)}" />`,
  ].join('\n    ')
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

// Per-chain primary color (same as entry-client.tsx)
const CHAIN_PRIMARY: Record<string, string> = {
  flowEvm: '155 100% 35%',
  base: '221.2 83.2% 53.3%',
  polkadotHub: '256 30% 28%',
}

let templateCache: string | null = null

function getTemplate(): string {
  if (templateCache) return templateCache

  // On Vercel: cwd=/var/task, frontend is at /var/task/frontend/
  // Locally: cwd is the frontend dir itself
  const cwd = process.cwd()
  const candidates = [
    join(cwd, 'frontend/dist/client/index.html'),
    join(cwd, 'dist/client/index.html'),
    join(cwd, 'index.html'),
  ]

  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      templateCache = readFileSync(candidate, 'utf-8')
      return templateCache
    }
  }

  // Fallback: minimal HTML shell so the page doesn't break entirely
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>AutoPayProtocol</title></head><body><div id="root"></div></body></html>`
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse,
) {
  try {
    const url = new URL(req.url!, `https://${req.headers.host}`)
    const pathname = url.pathname

    // Only SSR public routes — everything else gets the SPA shell
    if (!isSSRRoute(pathname)) {
      return res.setHeader('Content-Type', 'text/html').status(200).send(getTemplate())
    }

    // Fetch checkout data for /pay/:shortId routes (for OG tags)
    let checkoutData: Awaited<ReturnType<typeof fetchCheckoutData>> = null
    if (pathname.startsWith('/pay/')) {
      const shortId = pathname.slice('/pay/'.length)
      if (shortId) {
        checkoutData = await fetchCheckoutData(shortId)
      }
    }

    // Build dynamic meta tags
    const metaTags = buildMetaTags(pathname, checkoutData)

    // Get the client HTML template
    let template = getTemplate()

    // Inject chain-specific primary color
    const chain = process.env.VITE_DEFAULT_CHAIN || 'flowEvm'
    const chainPrimary = CHAIN_PRIMARY[chain]
    if (chainPrimary) {
      const chainStyle = `<style>:root { --primary: ${chainPrimary} !important; }</style>`
      template = template.replace('</head>', `${chainStyle}\n</head>`)
    }

    // Replace the static meta tags in <head> with dynamic ones
    template = template.replace(/<title>.*?<\/title>/s, '')
    template = template.replace(/<meta\s+name="description"[^>]*>/g, '')
    template = template.replace(/<meta\s+property="og:[^"]*"[^>]*>/g, '')
    template = template.replace(/<meta\s+name="twitter:[^"]*"[^>]*>/g, '')

    // Inject dynamic meta tags before </head>
    template = template.replace('</head>', `${metaTags}\n</head>`)

    // If we have checkout data, inject it as a script for client hydration
    if (checkoutData) {
      const prefetchScript = `<script>window.__SSR_CHECKOUT_DATA__=${JSON.stringify(checkoutData).replace(/</g, '\\u003c')}</script>`
      template = template.replace('</head>', `${prefetchScript}\n</head>`)
    }

    // Set cache headers
    if (pathname === '/' || pathname === '/docs' || pathname === '/terms' || pathname === '/privacy') {
      res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400')
    } else if (pathname.startsWith('/pay/')) {
      res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600')
    }

    return res.setHeader('Content-Type', 'text/html').status(200).send(template)
  } catch (err) {
    console.error('SSR handler error:', err)
    // Fallback: return minimal HTML that loads the SPA
    return res.setHeader('Content-Type', 'text/html').status(200).send(getTemplate())
  }
}
