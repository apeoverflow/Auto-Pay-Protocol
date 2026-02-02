import * as React from 'react'
import { useRecovery } from '../../hooks'
import { Button } from '../ui/button'
import { TextArea } from '../ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../ui/card'
import { Alert, AlertTitle, AlertDescription } from '../ui/alert'
import { StatusMessage } from '../common/StatusMessage'
import { KeyRound, CheckCircle, Loader2 } from 'lucide-react'

interface RecoveryScreenProps {
  onCancel: () => void
}

export function RecoveryScreen({ onCancel }: RecoveryScreenProps) {
  const {
    recoveryStatus,
    recoveredAddress,
    isLoading,
    validateRecoveryPhrase,
    confirmRecovery,
    clearRecovery,
  } = useRecovery()

  const [mnemonic, setMnemonic] = React.useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (mnemonic.trim()) {
      validateRecoveryPhrase(mnemonic)
    }
  }

  const handleCancel = () => {
    clearRecovery()
    onCancel()
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <CardTitle>Recover Your Wallet</CardTitle>
          </div>
          <CardDescription>
            Enter your 12-word recovery phrase to regain access to your wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleSubmit} className="space-y-4">
            <TextArea
              value={mnemonic}
              onChange={(e) => setMnemonic(e.target.value)}
              placeholder="Enter your 12-word recovery phrase..."
              className="min-h-[100px]"
              label="Recovery Phrase"
            />

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={!mnemonic.trim() || isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Validating...
                  </>
                ) : (
                  'Validate Phrase'
                )}
              </Button>
              <Button type="button" variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
            </div>
          </form>

          {recoveredAddress && (
            <Alert variant="success">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Account found!</AlertTitle>
              <AlertDescription className="space-y-3">
                <div>
                  <span className="font-medium">Address:</span>
                  <code className="block mt-1 text-xs font-mono break-all bg-success/10 p-2 rounded">
                    {recoveredAddress}
                  </code>
                </div>
                <p className="text-sm">
                  Click "Confirm Recovery" to create a new passkey for this wallet.
                </p>
                <Button
                  variant="success"
                  onClick={confirmRecovery}
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Recovering...
                    </>
                  ) : (
                    'Confirm Recovery'
                  )}
                </Button>
              </AlertDescription>
            </Alert>
          )}

          <StatusMessage
            message={recoveryStatus}
            type={
              recoveryStatus.startsWith('Invalid') || recoveryStatus.startsWith('Recovery failed')
                ? 'error'
                : 'info'
            }
          />
        </CardContent>
      </Card>
    </div>
  )
}
