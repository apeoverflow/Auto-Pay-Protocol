import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/card'

export function NotConfiguredView() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Configuration Required</CardTitle>
          <CardDescription>
            Set up your environment to get started
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">
              Please set the following environment variables:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>
                <code className="bg-muted px-1 py-0.5 rounded text-xs">VITE_CLIENT_KEY</code>
                {' '}- Your Circle client key
              </li>
              <li>
                <code className="bg-muted px-1 py-0.5 rounded text-xs">VITE_CLIENT_URL</code>
                {' '}- Circle RPC URL
              </li>
            </ul>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm text-muted-foreground mb-2">
              Optional for social login:
            </p>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>
                <code className="bg-muted px-1 py-0.5 rounded text-xs">VITE_DYNAMIC_ENV_ID</code>
                {' '}- Dynamic environment ID
              </li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
