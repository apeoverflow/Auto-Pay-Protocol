import { useEffect, useMemo, useRef } from 'react'
import { useChain } from '../contexts/ChainContext'
import { useWallet } from '../hooks'
import { useConnectModal } from '@rainbow-me/rainbowkit'
import { LiFiWidget, type WidgetConfig, ChainType } from '@lifi/widget'
import { EVM } from '@lifi/sdk'
import { useAccount, useConfig } from 'wagmi'
import { getConnectorClient } from 'wagmi/actions'
import { createWalletClient, custom } from 'viem'
import { Globe, CircleDollarSign, Zap, Shield, ExternalLink } from 'lucide-react'


const STEPS = [
  { icon: Globe, title: 'Pick source', iconColor: 'text-blue-600' },
  { icon: CircleDollarSign, title: 'Swap to USDC', iconColor: 'text-emerald-600' },
  { icon: Zap, title: (chain: string) => `Bridge to ${chain}`, iconColor: 'text-amber-600' },
  { icon: Shield, title: 'Subscribe', iconColor: 'text-violet-600' },
]

const CHAINS = [
  'Flow', 'Ethereum', 'Arbitrum', 'Optimism', 'Base',
  'Polygon', 'Avalanche', 'BSC', 'Solana', 'Fantom',
  'zkSync', 'Linea', 'Scroll', 'Gnosis',
]

// All EVM chains supported by LI.FI (sorted: majors first, then alphabetical)
const SWITCH_NETWORKS = [
  { id: 1, name: 'Ethereum' },
  { id: 42161, name: 'Arbitrum' },
  { id: 8453, name: 'Base' },
  { id: 56, name: 'BSC' },
  { id: 10, name: 'Optimism' },
  { id: 137, name: 'Polygon' },
  { id: 43114, name: 'Avalanche' },
  { id: 747, name: 'Flow' },
  { id: 2741, name: 'Abstract' },
  { id: 33139, name: 'Apechain' },
  { id: 80094, name: 'Berachain' },
  { id: 81457, name: 'Blast' },
  { id: 60808, name: 'BOB' },
  { id: 288, name: 'Boba' },
  { id: 42220, name: 'Celo' },
  { id: 21000000, name: 'Corn' },
  { id: 25, name: 'Cronos' },
  { id: 42793, name: 'Etherlink' },
  { id: 14, name: 'Flare' },
  { id: 252, name: 'Fraxtal' },
  { id: 122, name: 'Fuse' },
  { id: 100, name: 'Gnosis' },
  { id: 1625, name: 'Gravity' },
  { id: 43111, name: 'Hemi' },
  { id: 999, name: 'HyperEVM' },
  { id: 1337, name: 'Hyperliquid' },
  { id: 13371, name: 'Immutable zkEVM' },
  { id: 57073, name: 'Ink' },
  { id: 8217, name: 'Kaia' },
  { id: 747474, name: 'Katana' },
  { id: 232, name: 'Lens' },
  { id: 59144, name: 'Linea' },
  { id: 1135, name: 'Lisk' },
  { id: 5000, name: 'Mantle' },
  { id: 4326, name: 'MegaETH' },
  { id: 1088, name: 'Metis' },
  { id: 34443, name: 'Mode' },
  { id: 143, name: 'Monad' },
  { id: 1284, name: 'Moonbeam' },
  { id: 204, name: 'opBNB' },
  { id: 9745, name: 'Plasma' },
  { id: 98866, name: 'Plume' },
  { id: 2020, name: 'Ronin' },
  { id: 30, name: 'Rootstock' },
  { id: 534352, name: 'Scroll' },
  { id: 1329, name: 'Sei' },
  { id: 146, name: 'Sonic' },
  { id: 1868, name: 'Soneium' },
  { id: 50104, name: 'Sophon' },
  { id: 988, name: 'Stable' },
  { id: 55244, name: 'Superposition' },
  { id: 1923, name: 'Swellchain' },
  { id: 167000, name: 'Taiko' },
  { id: 40, name: 'Telos' },
  { id: 130, name: 'Unichain' },
  { id: 1480, name: 'Vana' },
  { id: 88, name: 'Viction' },
  { id: 480, name: 'World Chain' },
  { id: 50, name: 'XDC' },
  { id: 324, name: 'zkSync' },
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
  const { setSuppressAutoSwitch, chainConfig } = useChain()
  const wagmiConfig = useConfig()
  const { chainId, connector } = useAccount()
  const widgetRef = useRef<HTMLDivElement>(null)
  useWidgetScale(widgetRef)

  // Disable ChainContext's auto-switch on the bridge page
  useEffect(() => {
    setSuppressAutoSwitch(true)
    return () => setSuppressAutoSwitch(false)
  }, [setSuppressAutoSwitch])

  const currentNetwork = SWITCH_NETWORKS.find(n => n.id === chainId)

  const widgetConfig: WidgetConfig = useMemo(
    () => ({
      integrator: 'AutoPay',
      toChain: chainConfig.chain.id,
      toToken: chainConfig.usdc,
      toAddress: address
        ? { address, chainType: ChainType.EVM, name: 'Connected Wallet' }
        : undefined,
      appearance: 'light',
      apiKey: import.meta.env.VITE_LIFI_API_KEY,
      fee: 0.005,
      hiddenUI: ['poweredBy', 'contactSupport'],
      disabledUI: ['toToken', 'toAddress'],
      sdkConfig: {
        providers: [
          EVM({
            getWalletClient: () => getConnectorClient(wagmiConfig, { assertChainId: false }),
            switchChain: async (reqChainId) => {
              const connectorProvider = await connector?.getProvider() as any
              const provider = connectorProvider || (window as any).ethereum
              await provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: `0x${reqChainId.toString(16)}` }],
              })
              await new Promise(resolve => setTimeout(resolve, 200))
              const [account] = await provider.request({ method: 'eth_accounts' }) as string[]
              const chain = wagmiConfig.chains.find(c => c.id === reqChainId)
              return createWalletClient({
                account: account as `0x${string}`,
                chain,
                transport: custom(provider),
              })
            },
          }),
        ],
      },
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
    [address, openConnectModal, wagmiConfig, connector, chainConfig],
  )

  return (
    <div className="bridge-page">
      {/* ── Step indicators ── */}
      <div className="bridge-steps">
        {STEPS.map((step, i) => (
          <div key={i} className="bridge-step">
            <step.icon className={`h-3.5 w-3.5 ${step.iconColor}`} />
            <span>{typeof step.title === 'function' ? step.title(chainConfig.shortName) : step.title}</span>
            {i < STEPS.length - 1 && <div className="bridge-step-connector" />}
          </div>
        ))}
      </div>

      <div className="bridge-center">
        {/* ── Current network indicator ── */}
        {chainId && (
          <div className="flex justify-end mb-2">
            <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-border bg-background">
              <div className="w-2 h-2 rounded-full bg-emerald-500" />
              {currentNetwork?.name ?? `Chain ${chainId}`}
            </div>
          </div>
        )}

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
