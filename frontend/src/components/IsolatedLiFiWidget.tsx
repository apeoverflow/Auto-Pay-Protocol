import { useEffect, useRef, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import {
  WagmiProvider,
  createConfig,
  createStorage,
  http,
  useAccount,
  useConnect,
} from 'wagmi'
import { walletConnect } from 'wagmi/connectors'
import {
  mainnet,
  arbitrum,
  optimism,
  base,
  polygon,
  bsc,
  avalanche,
  gnosis,
} from 'wagmi/chains'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { LiFiWidget, type WidgetConfig, ChainType } from '@lifi/widget'

const FLOW_USDC = '0xF1815bd50389c46847f0Bda824eC8da914045D14'
const FLOW_CHAIN_ID = 747

const projectId =
  import.meta.env.VITE_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

// Isolated storage so disconnecting here never clears the app's wagmi state
const widgetWagmiConfig = createConfig({
  chains: [mainnet, arbitrum, optimism, base, polygon, bsc, avalanche, gnosis],
  storage: createStorage({ key: 'wagmi-bridge' }),
  connectors: [walletConnect({ projectId })],
  transports: {
    [mainnet.id]: http(),
    [arbitrum.id]: http(),
    [optimism.id]: http(),
    [base.id]: http(),
    [polygon.id]: http(),
    [bsc.id]: http(),
    [avalanche.id]: http(),
    [gnosis.id]: http(),
  },
})

const widgetQueryClient = new QueryClient()

function buildConfig(toAddress?: string): WidgetConfig {
  return {
    integrator: 'autopay-protocol',
    toChain: FLOW_CHAIN_ID,
    toToken: FLOW_USDC,
    toAddress: toAddress
      ? {
          address: toAddress,
          chainType: ChainType.EVM,
          name: 'Connected Wallet',
        }
      : undefined,
    appearance: 'light',
    apiKey: import.meta.env.VITE_LIFI_API_KEY,
    fee: 0.005,
    hiddenUI: ['poweredBy', 'contactSupport'],
    disabledUI: ['toToken', 'toAddress'],
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
        background: { default: '#ffffff', paper: '#f5f5f7' },
        text: { primary: '#1D1D1F', secondary: '#86868B' },
      },
      shape: { borderRadius: 10, borderRadiusSecondary: 8 },
      typography: {
        fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
        fontSize: 14,
      },
      components: {
        MuiCard: { styleOverrides: { root: { padding: '12px 16px' } } },
        MuiButton: {
          styleOverrides: {
            root: { fontSize: '0.875rem', padding: '10px 20px' },
          },
        },
      },
    },
  }
}

function WCSourceBar() {
  const { address, isConnected } = useAccount()
  const { connect, connectors } = useConnect()

  const short = address
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : ''

  const triggerConnect = () => {
    const wc = connectors.find((c) => c.id === 'walletConnect')
    if (wc) connect({ connector: wc })
  }

  if (isConnected) {
    return (
      <div style={barStyles.bar}>
        <div style={barStyles.left}>
          <div style={barStyles.dot} />
          <span style={barStyles.label}>Source:</span>
          <span style={barStyles.addr}>{short}</span>
        </div>
        <button onClick={triggerConnect} style={barStyles.changeBtn}>
          Change
        </button>
      </div>
    )
  }

  return (
    <div style={barStyles.bar}>
      <span style={barStyles.label}>Connect source wallet via WalletConnect</span>
      <button onClick={triggerConnect} style={barStyles.connectBtn}>
        Connect
      </button>
    </div>
  )
}

const barStyles: Record<string, React.CSSProperties> = {
  bar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 16px',
    borderBottom: '1px solid #f0f0f2',
    gap: 8,
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    minWidth: 0,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    background: '#16A34A',
    flexShrink: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 500,
    color: '#86868B',
    whiteSpace: 'nowrap' as const,
  },
  addr: {
    fontSize: 13,
    fontWeight: 600,
    color: '#1D1D1F',
    whiteSpace: 'nowrap' as const,
  },
  connectBtn: {
    fontSize: 12,
    fontWeight: 600,
    color: '#fff',
    background: '#0052FF',
    border: 'none',
    borderRadius: 8,
    padding: '7px 14px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
  changeBtn: {
    fontSize: 12,
    fontWeight: 500,
    color: '#86868B',
    background: '#f5f5f7',
    border: 'none',
    borderRadius: 6,
    padding: '5px 10px',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
    flexShrink: 0,
  },
}

function WidgetInner({ toAddress }: { toAddress?: string }) {
  return (
    <WagmiProvider config={widgetWagmiConfig}>
      <QueryClientProvider client={widgetQueryClient}>
        <WCSourceBar />
        <LiFiWidget {...buildConfig(toAddress)} />
      </QueryClientProvider>
    </WagmiProvider>
  )
}

export function IsolatedLiFiWidget({ toAddress }: { toAddress?: string }) {
  const [container] = useState(() => document.createElement('div'))
  const rootRef = useRef<Root | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const wrapper = wrapperRef.current
    if (!wrapper) return
    wrapper.appendChild(container)
    return () => {
      container.remove()
    }
  }, [container])

  useEffect(() => {
    if (!rootRef.current) {
      rootRef.current = createRoot(container)
    }
    rootRef.current.render(<WidgetInner toAddress={toAddress} />)
  }, [container, toAddress])

  useEffect(() => {
    return () => {
      const root = rootRef.current
      if (root) {
        rootRef.current = null
        setTimeout(() => root.unmount(), 0)
      }
    }
  }, [])

  return <div ref={wrapperRef} />
}
