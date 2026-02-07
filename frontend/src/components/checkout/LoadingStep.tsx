import { Loader2 } from 'lucide-react'

export function LoadingStep() {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Loader2 className="w-8 h-8 text-primary animate-spin mb-4" />
      <p className="text-muted-foreground text-sm">Loading checkout...</p>
    </div>
  )
}
