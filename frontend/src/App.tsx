import { useAuth, useWallet } from './hooks'
import { isConfigured } from './config'
import { AuthScreen } from './components/auth'
import { WalletDashboard } from './components/wallet'
import { NotConfiguredView, LoadingView } from './views'

function App() {
  const { isLoggedIn } = useAuth()
  const { account, isLoading } = useWallet()

  if (!isConfigured) {
    return <NotConfiguredView />
  }

  if (!isLoggedIn) {
    return <AuthScreen />
  }

  if (isLoading || !account) {
    return <LoadingView />
  }

  return <WalletDashboard />
}

export default App
