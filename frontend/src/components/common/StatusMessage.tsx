import { cn } from '../../lib/utils'

interface StatusMessageProps {
  message: string
  type?: 'info' | 'success' | 'warning' | 'error'
  className?: string
}

const typeClasses: Record<string, string> = {
  info: 'text-foreground',
  success: 'text-success',
  warning: 'text-warning-foreground',
  error: 'text-destructive',
}

export function StatusMessage({ message, type = 'info', className }: StatusMessageProps) {
  if (!message) return null

  return (
    <p className={cn('mt-2 text-sm', typeClasses[type], className)}>
      {message}
    </p>
  )
}
