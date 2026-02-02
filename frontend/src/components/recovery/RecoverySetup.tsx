import { useRecovery } from '../../hooks'
import { Button } from '../ui/button'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Alert, AlertTitle, AlertDescription } from '../ui/alert'
import { Badge } from '../ui/badge'
import { StatusMessage } from '../common/StatusMessage'
import { Shield, AlertTriangle, Copy, Check, Loader2 } from 'lucide-react'

export function RecoverySetup() {
  const {
    recoveryMnemonic,
    recoveryStatus,
    hasRecoveryKey,
    isLoading,
    generateRecoveryKey,
    clearRecovery,
  } = useRecovery()

  const handleCopyToClipboard = () => {
    if (recoveryMnemonic) {
      navigator.clipboard.writeText(recoveryMnemonic)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg">Security</CardTitle>
          </div>
          {hasRecoveryKey && (
            <Badge variant="success">Protected</Badge>
          )}
        </div>
        <CardDescription>
          Set up a recovery key to regain access if you lose your passkey
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasRecoveryKey ? (
          <Button
            onClick={generateRecoveryKey}
            disabled={isLoading || !!recoveryMnemonic}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Shield className="h-4 w-4 mr-2" />
                Generate Recovery Key
              </>
            )}
          </Button>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-success">
              <Check className="h-4 w-4" />
              <span className="text-sm font-medium">Recovery key registered</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Lost your recovery phrase? You can generate a new one (this will replace the old one).
            </p>
            <Button
              variant="outline"
              onClick={generateRecoveryKey}
              disabled={isLoading || !!recoveryMnemonic}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                'Generate New Recovery Key'
              )}
            </Button>
          </div>
        )}

        <StatusMessage
          message={recoveryStatus}
          type={recoveryStatus.startsWith('Error') ? 'error' : 'info'}
        />

        {recoveryMnemonic && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Save this recovery phrase securely!</AlertTitle>
            <AlertDescription className="space-y-3">
              <p className="text-sm">
                This is the only way to recover your wallet if you lose access.
                Write it down and store it safely. Never share it with anyone.
              </p>
              <code className="block p-3 bg-background rounded-md text-sm font-mono break-all border">
                {recoveryMnemonic}
              </code>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleCopyToClipboard}>
                  <Copy className="h-3 w-3 mr-2" />
                  Copy
                </Button>
                <Button size="sm" onClick={clearRecovery}>
                  <Check className="h-3 w-3 mr-2" />
                  I've saved it
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  )
}
