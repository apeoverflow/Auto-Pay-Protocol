// Stub for unused LI.FI peer deps (Solana, Sui, UTXO)
// Exports real React contexts (with null defaults) so useContext() won't crash,
// and noop hooks/components so the widget's non-EVM providers render harmlessly.
import { createContext } from 'react'

// Contexts
export const ConnectionContext = createContext(null)
export const BigmiContext = createContext(null)
export const SuiClientContext = createContext(null)

// Noop hooks
export const useWallet = () => ({ connected: false, publicKey: null, wallet: null, wallets: [], select: () => {}, connect: async () => {}, disconnect: async () => {}, signTransaction: async () => null, signAllTransactions: async () => [], sendTransaction: async () => '' })
export const useAccount = () => ({ address: undefined, isConnected: false })
export const useConfig = () => ({})
export const useConnect = () => ({ connect: () => {}, connectors: [], pendingConnector: null, isLoading: false, error: null })
export const useReconnect = () => ({ reconnect: () => {} })
export const useCurrentWallet = () => ({ currentWallet: null, connectionStatus: 'disconnected' })
export const useConnectWallet = () => ({ mutate: () => {} })
export const useDisconnectWallet = () => ({ mutate: () => {} })
export const useWallets = () => []

// Noop components / providers — render children only
export const ConnectionProvider = ({ children }: any) => children
export const WalletProvider = ({ children }: any) => children
export const BigmiProvider = ({ children }: any) => children
export const SuiClientProvider = ({ children }: any) => children
export const createNetworkConfig = () => ({ networkConfig: {} })

export default {}
