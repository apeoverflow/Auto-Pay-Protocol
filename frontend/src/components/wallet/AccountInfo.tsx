import { useAuth, useWallet } from '../../hooks'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { RefreshCw, LogOut, Wallet } from 'lucide-react'
import { DualAddress } from '../shared/DualAddress'

export function AccountInfo() {
  const { username, logout } = useAuth()
  const { address, balance, fetchBalance } = useWallet()

  if (!address) return null

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Account</CardTitle>
          </div>
          <Badge variant="secondary">Browser Wallet</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address */}
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Wallet Address</label>
          <DualAddress address={address} full copyable />
        </div>

        {/* Username */}
        {username && (
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Username</label>
            <p className="text-sm font-medium">{username}</p>
          </div>
        )}

        {/* Balance */}
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div>
            <label className="text-sm text-muted-foreground">USDC Balance</label>
            <p className="text-2xl font-bold">
              {balance !== null ? `${balance}` : '...'}
              <span className="text-sm font-normal text-muted-foreground ml-1">USDC</span>
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={fetchBalance}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Logout */}
        <Button variant="outline" onClick={logout} className="w-full">
          <LogOut className="h-4 w-4 mr-2" />
          Disconnect
        </Button>
      </CardContent>
    </Card>
  )
}
