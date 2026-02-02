import { useAuth, useWallet } from '../../hooks'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card'
import { Badge } from '../ui/badge'
import { Copy, RefreshCw, LogOut, Wallet } from 'lucide-react'

export function AccountInfo() {
  const { username, logout } = useAuth()
  const { account, balance, fetchBalance } = useWallet()

  if (!account) return null

  const copyAddress = () => {
    navigator.clipboard.writeText(account.address)
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Account</CardTitle>
          </div>
          <Badge variant="secondary">Passkey</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Address */}
        <div className="space-y-1">
          <label className="text-sm text-muted-foreground">Smart Wallet Address</label>
          <div className="flex items-center gap-2">
            <code className="flex-1 bg-muted px-3 py-2 rounded-md text-sm font-mono truncate">
              {account.address}
            </code>
            <Button variant="ghost" size="icon" onClick={copyAddress}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
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
          Logout
        </Button>
      </CardContent>
    </Card>
  )
}
