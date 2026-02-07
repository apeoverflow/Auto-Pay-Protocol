import { AlertCircle, ArrowLeft } from 'lucide-react'

interface ErrorStepProps {
  message: string
  cancelUrl?: string
}

export function ErrorStep({ message, cancelUrl }: ErrorStepProps) {
  return (
    <div className="flex flex-col items-center py-12 px-4">
      <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mb-4">
        <AlertCircle className="w-7 h-7 text-destructive" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Something went wrong</h2>
      <p className="text-sm text-muted-foreground text-center mb-6 max-w-xs">
        {message}
      </p>
      {cancelUrl && (
        <a
          href={cancelUrl}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Return to merchant
        </a>
      )}
    </div>
  )
}
