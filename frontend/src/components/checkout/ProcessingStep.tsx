import { Loader2 } from 'lucide-react'

interface ProcessingStepProps {
  status: string
}

export function ProcessingStep({ status }: ProcessingStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-5">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
      <h2 className="text-lg font-semibold mb-2">Processing payment</h2>
      <p className="text-sm text-muted-foreground text-center">{status}</p>
      <p className="text-xs text-muted-foreground mt-4">
        Please confirm the passkey prompt if shown
      </p>
    </div>
  )
}
