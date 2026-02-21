import { useEffect, useMemo, useRef } from 'react'
import { useWallet } from '../hooks'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { LiFiWidget, type WidgetConfig, ChainType } from '@lifi/widget'
import { Globe, CircleDollarSign, Zap, Shield, ExternalLink } from 'lucide-react'

const FLOW_USDC = '0xF1815bd50389c46847f0Bda824eC8da914045D14'
const FLOW_CHAIN_ID = 747

const STEPS = [
  { icon: Globe, title: 'Pick source', iconColor: 'text-blue-600' },
  { icon: CircleDollarSign, title: 'Swap to USDC', iconColor: 'text-emerald-600' },
  { icon: Zap, title: 'Bridge to Flow', iconColor: 'text-amber-600' },
  { icon: Shield, title: 'Subscribe', iconColor: 'text-violet-600' },
]

const CHAINS = [
  'Flow', 'Ethereum', 'Arbitrum', 'Optimism', 'Base',
  'Polygon', 'Avalanche', 'BSC', 'Solana', 'Fantom',
  'zkSync', 'Linea', 'Scroll', 'Gnosis',
]

function useWidgetScale(wrapRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return

    const update = () => {
      const top = el.getBoundingClientRect().top
      const available = window.innerHeight - top - 80
      const intrinsic = 700
      const scale = Math.min(0.96, Math.max(0.68, available / intrinsic))
      el.style.transform = `scale(${scale})`
      el.style.marginBottom = `${(scale - 1) * intrinsic}px`
    }

    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [wrapRef])
}

export function BridgePage() {
  const { address } = useWallet()
  const { openConnectModal } = useConnectModal()
  const widgetRef = useRef<HTMLDivElement>(null)
  useWidgetScale(widgetRef)

  const widgetConfig: WidgetConfig = useMemo(
    () => ({
      integrator: 'AutoPay',
      fromChain: 1, // Default source to Ethereum mainnet
      toChain: FLOW_CHAIN_ID,
      toToken: FLOW_USDC,
      toAddress: address
        ? { address, chainType: ChainType.EVM, name: 'Connected Wallet' }
        : undefined,
      appearance: 'light',
      apiKey: import.meta.env.VITE_LIFI_API_KEY,
      fee: 0.005,
      hiddenUI: ['poweredBy', 'contactSupport'],
      disabledUI: ['toToken', 'toAddress'],
      walletConfig: {
        onConnect() {
          openConnectModal?.()
        },
      },
      theme: {
        container: {
          border: 'none',
          borderRadius: '0px',
          boxShadow: 'none',
          background: 'transparent',
        },
        palette: {
          primary: { main: '#0052FF' },
          secondary: { main: '#f5f5f7' },
          background: {
            default: '#ffffff',
            paper: '#f5f5f7',
          },
          text: {
            primary: '#1D1D1F',
            secondary: '#86868B',
          },
        },
        shape: { borderRadius: 10, borderRadiusSecondary: 8 },
        typography: {
          fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
          fontSize: 14,
        },
        components: {
          MuiCard: {
            styleOverrides: {
              root: { padding: '12px 16px' },
            },
          },
          MuiButton: {
            styleOverrides: {
              root: { fontSize: '0.875rem', padding: '10px 20px' },
            },
          },
        },
      },
    }),
    [address, openConnectModal],
  )

  return (
    <div className="bridge-page">
      {/* ── Step indicators ── */}
      <div className="bridge-steps">
        {STEPS.map((step, i) => (
          <div key={i} className="bridge-step">
            <step.icon className={`h-3.5 w-3.5 ${step.iconColor}`} />
            <span>{step.title}</span>
            {i < STEPS.length - 1 && <div className="bridge-step-connector" />}
          </div>
        ))}
      </div>

      <div className="bridge-center">
        {/* ── Widget ── */}
        <div className="bridge-widget-card">
          <div ref={widgetRef} className="bridge-widget-wrap">
            <LiFiWidget {...widgetConfig} />
          </div>
        </div>

        {/* ── Footer ── */}
        <div className="bridge-footer">
          <div className="bridge-chains">
            <span className="text-[11px] font-medium text-muted-foreground/70 mr-1 whitespace-nowrap">30+ chains</span>
            <span className="bridge-chain-divider" />
            {CHAINS.map((name) => (
              <span key={name} className="text-[11px] text-muted-foreground/50 font-medium whitespace-nowrap">
                {name}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/40">
            <span>Powered by</span>
            <a
              href="https://li.fi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-semibold text-muted-foreground/50 hover:text-muted-foreground transition-colors"
            >
              LI.FI
              <ExternalLink className="h-2.5 w-2.5" />
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
